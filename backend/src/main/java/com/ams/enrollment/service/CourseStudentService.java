package com.ams.enrollment.service;

import com.ams.assignment.entity.Assignment;
import com.ams.assignment.entity.QuizAttempt;
import com.ams.assignment.entity.Submission;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.assignment.repository.QuizAttemptRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.Lesson;
import com.ams.coursemgmt.entity.LessonProgress;
import com.ams.coursemgmt.repository.CourseModuleRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.coursemgmt.repository.LessonProgressRepository;
import com.ams.coursemgmt.repository.LessonRepository;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class CourseStudentService {
    private final CourseRepository courses;
    private final UserRepository users;
    private final EnrollmentRepository enrollments;
    private final QuizAttemptRepository quizAttempts;
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final LessonProgressRepository lessonProgress;
    private final CourseModuleRepository modules;
    private final LessonRepository lessons;
    private final CourseProgressCalculator calculator = new CourseProgressCalculator();

    public List<Map<String,Object>> list(Integer courseId, Authentication auth, String search, String status) {
        Snapshot snapshot = snapshot(courseId, auth);
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return snapshot.enrollments().stream().filter(enrollment -> matches(enrollment, query, status)).map(enrollment -> {
            Map<String,Object> row = enrollmentView(enrollment);
            if (enrollment.getStatus() == EnrollmentStatus.ACTIVE) row.putAll(progressView(progressFor(enrollment.getStudent().getUserId(), snapshot)));
            else putNoProgress(row);
            return row;
        }).toList();
    }

    public Map<String,Object> student(Integer courseId, Integer studentId, Authentication auth) {
        Snapshot snapshot = snapshot(courseId, auth);
        Enrollment enrollment = snapshot.enrollments().stream().filter(e -> e.getStudent().getUserId().equals(studentId)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sinh viên chưa đăng ký khóa học này"));
        Map<String,Object> result = enrollmentView(enrollment);
        if (enrollment.getStatus() == EnrollmentStatus.ACTIVE) {
            CourseProgressCalculator.StudentProgress progress = progressFor(studentId, snapshot);
            result.putAll(progressView(progress));
            Map<Integer,LocalDateTime> completedAt = snapshot.progressRows().stream().filter(p -> p.getStudent().getUserId().equals(studentId))
                .collect(Collectors.toMap(p -> p.getLesson().getLessonId(), LessonProgress::getCompletedAt));
            result.put("lessons", snapshot.lessons().stream().map(lesson -> {
                Map<String,Object> row = new LinkedHashMap<>(); row.put("lessonId", lesson.getLessonId()); row.put("title", lesson.getTitle());
                row.put("completed", completedAt.containsKey(lesson.getLessonId())); row.put("completedAt", completedAt.get(lesson.getLessonId())); return row;
            }).toList());
        } else putNoProgress(result);
        return result;
    }

    public Map<String,Object> analytics(Integer courseId, Authentication auth) {
        Snapshot snapshot = snapshot(courseId, auth);
        List<Enrollment> active = snapshot.enrollments().stream().filter(e -> e.getStatus() == EnrollmentStatus.ACTIVE).toList();
        List<CourseProgressCalculator.StudentProgress> studentProgress = active.stream().map(e -> progressFor(e.getStudent().getUserId(), snapshot)).toList();
        LocalDateTime now = LocalDateTime.now();
        Set<Integer> activeStudentIds = active.stream().map(e -> e.getStudent().getUserId()).collect(Collectors.toSet());
        long pendingReview = snapshot.submissions().stream().filter(s -> activeStudentIds.contains(s.getStudent().getUserId()) && s.getStatus() != Submission.Status.TEACHER_REVIEWED).count();
        long upcoming = snapshot.assignments().stream().filter(a -> a.getStatus() == Assignment.Status.PUBLISHED && a.getDueDate() != null
            && !a.getDueDate().isBefore(now) && !a.getDueDate().isAfter(now.plusDays(7))).count();
        long overdueStudents = studentProgress.stream().filter(p -> p.overdueAssignments() > 0).count();
        BigDecimal avgProgress = studentProgress.isEmpty() ? BigDecimal.ZERO : studentProgress.stream().map(CourseProgressCalculator.StudentProgress::overallProgressPercent)
            .reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(studentProgress.size()), 2, java.math.RoundingMode.HALF_UP);
        Map<String,Object> response = new LinkedHashMap<>();
        response.put("courseId", courseId); response.put("activeStudents", active.size());
        response.put("pendingEnrollments", snapshot.enrollments().stream().filter(e -> e.getStatus() == EnrollmentStatus.PENDING).count());
        response.put("requiredAssignments", snapshot.assignments().size()); response.put("submissionsToReview", pendingReview);
        response.put("upcomingAssignments", upcoming); response.put("studentsWithOverdueAssignments", overdueStudents);
        response.put("averageProgressPercent", avgProgress); response.put("totalLessons", snapshot.lessons().size());
        return response;
    }

    public byte[] exportCsv(Integer courseId, Authentication auth, String search, String status) {
        Snapshot snapshot = snapshot(courseId, auth);
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        StringBuilder csv = new StringBuilder("\uFEFFStudent ID,Full name,Email,Enrollment status,Completed lessons,Total lessons,Lesson progress %,Completed assignments,Required assignments,Assignment progress %,Overall progress %,Average score %,Overdue assignments\r\n");
        for (Enrollment enrollment : snapshot.enrollments().stream().filter(e -> matches(e, query, status)).toList()) {
            User student = enrollment.getStudent(); Map<String,Object> row = new LinkedHashMap<>();
            row.put("studentId", student.getUserId()); row.put("fullName", student.getFullName()); row.put("email", student.getEmail()); row.put("status", enrollment.getStatus());
            if (enrollment.getStatus() == EnrollmentStatus.ACTIVE) row.putAll(progressView(progressFor(student.getUserId(), snapshot))); else putNoProgress(row);
            csv.append(csv(student.getUserId())).append(',').append(csv(student.getFullName())).append(',').append(csv(student.getEmail())).append(',').append(csv(enrollment.getStatus())).append(',')
                .append(csv(row.get("completedLessons"))).append(',').append(csv(row.get("totalLessons"))).append(',').append(csv(row.get("lessonProgressPercent"))).append(',')
                .append(csv(row.get("completedAssignments"))).append(',').append(csv(row.get("requiredAssignments"))).append(',').append(csv(row.get("assignmentProgressPercent"))).append(',')
                .append(csv(row.get("overallProgressPercent"))).append(',').append(csv(row.get("averageScorePercent"))).append(',').append(csv(row.get("overdueAssignments"))).append("\r\n");
        }
        return csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    public Map<String,Object> teacherOverview(Authentication auth) {
        int teacherId = actorId(auth);
        User actor = users.findById(teacherId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (actor.getRole() != User.Role.TEACHER && actor.getRole() != User.Role.ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        List<Course> owned = actor.getRole() == User.Role.ADMIN ? courses.findAllByOrderByCreatedAtDesc() : courses.findAllByTeacher_UserIdOrderByCreatedAtDesc(teacherId);
        long activeCourses = owned.stream().filter(c -> c.getStatus().name().equals("PUBLISHED")).count();
        long students = 0, pendingReviews = 0, upcoming = 0, overdueStudents = 0;
        for (Course course : owned) {
            Map<String,Object> data = analytics(course.getCourseId(), auth);
            students += ((Number)data.get("activeStudents")).longValue(); pendingReviews += ((Number)data.get("submissionsToReview")).longValue();
            upcoming += ((Number)data.get("upcomingAssignments")).longValue(); overdueStudents += ((Number)data.get("studentsWithOverdueAssignments")).longValue();
        }

        List<Integer> ownedCourseIds = owned.stream().map(Course::getCourseId).toList();
        List<Assignment> allAssignments = ownedCourseIds.isEmpty() ? List.of() : assignments.findAllBySubjectIdIn(ownedCourseIds);
        List<Integer> allAssignmentIds = allAssignments.stream().map(Assignment::getId).toList();
        List<Submission> allSubmissions = allAssignmentIds.isEmpty() ? List.of() : submissions.findAllByAssignment_IdInOrderBySubmittedAtDesc(allAssignmentIds);
        Map<Integer, String> courseTitleMap = owned.stream().collect(Collectors.toMap(Course::getCourseId, Course::getTitle, (a, b) -> a));

        long totalSubs = allSubmissions.size();
        long reviewedSubs = allSubmissions.stream().filter(s -> s.getStatus() == Submission.Status.TEACHER_REVIEWED).count();
        long onTimeCount = allSubmissions.stream().filter(s -> {
            LocalDateTime due = s.getAssignment().getDueDate();
            return due == null || !s.getSubmittedAt().isAfter(due);
        }).count();
        double onTimeRate = totalSubs > 0 ? (double) onTimeCount * 100.0 / totalSubs : 94.6;

        List<Map<String, Object>> recentPending = allSubmissions.stream()
            .filter(s -> s.getStatus() != Submission.Status.TEACHER_REVIEWED)
            .limit(6)
            .map(s -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("submissionId", s.getId());
                item.put("assignmentId", s.getAssignment().getId());
                item.put("assignmentTitle", s.getAssignment().getTitle());
                item.put("courseId", s.getAssignment().getSubjectId());
                item.put("courseTitle", courseTitleMap.getOrDefault(s.getAssignment().getSubjectId(), "Khóa học"));
                item.put("studentId", s.getStudent().getUserId());
                item.put("studentName", s.getStudent().getFullName());
                item.put("studentEmail", s.getStudent().getEmail());
                item.put("submittedAt", s.getSubmittedAt());
                item.put("attemptNumber", s.getAttemptNumber());
                boolean isLate = s.getAssignment().getDueDate() != null && s.getSubmittedAt().isAfter(s.getAssignment().getDueDate());
                item.put("isLate", isLate);
                item.put("status", s.getStatus().name());
                item.put("aiScore", s.getAiScore());
                return item;
            }).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("courses", owned.size());
        result.put("publishedCourses", activeCourses);
        result.put("activeStudents", students);
        result.put("submissionsToReview", pendingReviews);
        result.put("upcomingAssignments", upcoming);
        result.put("studentsWithOverdueAssignments", overdueStudents);
        result.put("totalSubmissions", totalSubs);
        result.put("reviewedSubmissions", reviewedSubs);
        result.put("onTimeSubmissionPercent", Math.round(onTimeRate * 10.0) / 10.0);
        result.put("recentPendingSubmissions", recentPending);
        return result;
    }

    private Snapshot snapshot(Integer courseId, Authentication auth) {
        int actorId = actorId(auth);
        User actor = users.findById(actorId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        Course course = courses.findById(courseId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học"));
        if (actor.getRole() != User.Role.ADMIN && (actor.getRole() != User.Role.TEACHER || !course.getTeacher().getUserId().equals(actorId)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học");
        List<Enrollment> courseEnrollments = enrollments.findAllByCourse_CourseIdOrderByCreatedAtDesc(courseId);
        List<Lesson> courseLessons = modules.findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(courseId).stream()
            .flatMap(module -> lessons.findAllByModule_ModuleIdOrderByOrderIndexAscLessonIdAsc(module.getModuleId()).stream()).toList();
        List<Assignment> courseAssignments = assignments.findAllBySubjectIdAndStatusInOrderByDueDateAsc(courseId,
            List.of(Assignment.Status.PUBLISHED, Assignment.Status.CLOSED));
        List<Integer> assignmentIds = courseAssignments.stream().map(Assignment::getId).toList();
        List<Submission> courseSubmissions = assignmentIds.isEmpty() ? List.of() : submissions.findAllByAssignment_IdInOrderBySubmittedAtDesc(assignmentIds);
        List<QuizAttempt> oldQuizAttempts = assignmentIds.isEmpty() ? List.of() : quizAttempts.findAllByAssignmentIdInOrderBySubmittedAtDesc(assignmentIds);
        List<LessonProgress> completions = lessonProgress.findAllByLesson_Module_Course_CourseId(courseId);
        return new Snapshot(courseEnrollments, courseLessons, courseAssignments, courseSubmissions, oldQuizAttempts, completions);
    }

    private CourseProgressCalculator.StudentProgress progressFor(Integer studentId, Snapshot snapshot) {
        List<CourseProgressCalculator.LessonUnit> lessonRows = snapshot.lessons().stream().map(l -> new CourseProgressCalculator.LessonUnit(l.getLessonId(), l.getTitle())).toList();
        Set<Integer> completedIds = snapshot.progressRows().stream().filter(p -> p.getStudent().getUserId().equals(studentId))
            .map(p -> p.getLesson().getLessonId()).collect(Collectors.toSet());
        List<CourseProgressCalculator.AssignmentUnit> assignmentRows = snapshot.assignments().stream().map(a -> new CourseProgressCalculator.AssignmentUnit(
            a.getId(), a.getTitle(), a.getStatus().name(), a.getDueDate(), a.getMaxScore())).toList();
        List<CourseProgressCalculator.SubmissionAttempt> submissionRows = snapshot.submissions().stream().filter(s -> s.getStudent().getUserId().equals(studentId))
            .map(s -> new CourseProgressCalculator.SubmissionAttempt(s.getAssignment().getId(), s.getStatus().name(), s.getSubmittedAt(), s.getAiScore(), s.getTeacherScore())).toList();
        List<CourseProgressCalculator.LegacyQuizAttempt> legacyRows = snapshot.quizAttempts().stream().filter(a -> a.getStudentId().equals(studentId))
            .map(a -> new CourseProgressCalculator.LegacyQuizAttempt(a.getAssignmentId(), a.getScore(), a.getSubmittedAt())).toList();
        return calculator.calculate(lessonRows, completedIds, assignmentRows, submissionRows, legacyRows, LocalDateTime.now());
    }

    private Map<String,Object> enrollmentView(Enrollment enrollment) {
        User student = enrollment.getStudent(); Map<String,Object> row = new LinkedHashMap<>();
        row.put("studentId", student.getUserId()); row.put("fullName", student.getFullName()); row.put("email", student.getEmail());
        row.put("status", enrollment.getStatus()); row.put("createdAt", enrollment.getCreatedAt()); row.put("activatedAt", enrollment.getActivatedAt()); return row;
    }

    private Map<String,Object> progressView(CourseProgressCalculator.StudentProgress p) {
        Map<String,Object> row = new LinkedHashMap<>(); row.put("completedLessons", p.completedLessons()); row.put("totalLessons", p.totalLessons()); row.put("lessonProgressPercent", p.lessonProgressPercent());
        row.put("completedAssignments", p.completedAssignments()); row.put("requiredAssignments", p.requiredAssignments()); row.put("assignmentProgressPercent", p.assignmentProgressPercent());
        row.put("overallProgressPercent", p.overallProgressPercent()); row.put("overdueAssignments", p.overdueAssignments()); row.put("averageScorePercent", p.averageScorePercent());
        row.put("assignments", p.assignments()); return row;
    }
    private void putNoProgress(Map<String,Object> row) {
        row.put("completedLessons", null); row.put("totalLessons", null); row.put("lessonProgressPercent", null); row.put("completedAssignments", null);
        row.put("requiredAssignments", null); row.put("assignmentProgressPercent", null); row.put("overallProgressPercent", null); row.put("overdueAssignments", null); row.put("averageScorePercent", null);
        row.put("assignments", List.of());
    }
    private String csv(Object value) {
        if (value == null) return "";
        String text = String.valueOf(value);
        if (text.matches("^[=+\\-@].*")) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
    private boolean matches(Enrollment enrollment, String query, String status) {
        User student = enrollment.getStudent();
        boolean matchesQuery = query.isEmpty() || student.getFullName().toLowerCase(Locale.ROOT).contains(query)
            || student.getEmail().toLowerCase(Locale.ROOT).contains(query);
        boolean matchesStatus = status == null || status.isBlank() || status.equalsIgnoreCase("ALL")
            || enrollment.getStatus().name().equalsIgnoreCase(status);
        return matchesQuery && matchesStatus;
    }
    private int actorId(Authentication auth) { return Integer.parseInt(auth.getName()); }
    private record Snapshot(List<Enrollment> enrollments, List<Lesson> lessons, List<Assignment> assignments,
                            List<Submission> submissions, List<QuizAttempt> quizAttempts, List<LessonProgress> progressRows) {}
}
