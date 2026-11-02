package com.ams.enrollment.service;

import com.ams.assignment.entity.Assignment;
import com.ams.assignment.entity.Submission;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.assignment.repository.QuizAttemptRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.entity.Lesson;
import com.ams.coursemgmt.entity.LessonProgress;
import com.ams.coursemgmt.repository.CourseModuleRepository;
import com.ams.coursemgmt.repository.LessonProgressRepository;
import com.ams.coursemgmt.repository.LessonRepository;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentCourseProgressService {
    private final LessonProgressRepository progress;
    private final LessonRepository lessons;
    private final CourseModuleRepository modules;
    private final EnrollmentRepository enrollments;
    private final UserRepository users;
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final QuizAttemptRepository quizAttempts;
    private final CourseProgressCalculator calculator = new CourseProgressCalculator();

    @Transactional
    public Map<String,Object> markComplete(Integer lessonId, Authentication auth) {
        int studentId = actorId(auth);
        Lesson lesson = lessons.findById(lessonId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài học"));
        int courseId = lesson.getModule().getCourse().getCourseId();
        requireActiveEnrollment(studentId, courseId);
        LessonProgress row = progress.findByStudent_UserIdAndLesson_LessonId(studentId, lessonId).orElseGet(() -> {
            User student = users.findById(studentId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
            LessonProgress created = new LessonProgress(); created.setStudent(student); created.setLesson(lesson);
            created.setCompletedAt(LocalDateTime.now()); return progress.save(created);
        });
        return Map.of("lessonId", lessonId, "completed", true, "completedAt", row.getCompletedAt());
    }

    @Transactional(readOnly = true)
    public Map<String,Object> ownProgress(Integer courseId, Authentication auth) {
        int studentId = actorId(auth); requireActiveEnrollment(studentId, courseId);
        List<Lesson> courseLessons = modules.findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(courseId).stream()
            .flatMap(module -> lessons.findAllByModule_ModuleIdOrderByOrderIndexAscLessonIdAsc(module.getModuleId()).stream()).toList();
        List<Assignment> courseAssignments = assignments.findAllBySubjectIdAndStatusInOrderByDueDateAsc(courseId,
            List.of(Assignment.Status.PUBLISHED, Assignment.Status.CLOSED));
        CourseProgressCalculator.StudentProgress summary = calculate(studentId, courseId, courseLessons, courseAssignments);
        Map<Integer,LocalDateTime> completedAt = progress.findAllByStudent_UserIdAndLesson_Module_Course_CourseId(studentId, courseId).stream()
            .collect(Collectors.toMap(row -> row.getLesson().getLessonId(), LessonProgress::getCompletedAt));
        List<Map<String,Object>> lessonRows = courseLessons.stream().map(lesson -> {
            Map<String,Object> row = new LinkedHashMap<>(); row.put("lessonId", lesson.getLessonId()); row.put("title", lesson.getTitle());
            row.put("completed", completedAt.containsKey(lesson.getLessonId())); row.put("completedAt", completedAt.get(lesson.getLessonId())); return row;
        }).toList();
        Map<String,Object> response = progressView(summary); response.put("lessons", lessonRows); return response;
    }

    private CourseProgressCalculator.StudentProgress calculate(int studentId, int courseId, List<Lesson> courseLessons, List<Assignment> courseAssignments) {
        List<Integer> assignmentIds = courseAssignments.stream().map(Assignment::getId).toList();
        List<CourseProgressCalculator.AssignmentUnit> assignmentRows = courseAssignments.stream().map(a -> new CourseProgressCalculator.AssignmentUnit(
            a.getId(), a.getTitle(), a.getStatus().name(), a.getDueDate(), a.getMaxScore())).toList();
        List<CourseProgressCalculator.SubmissionAttempt> submissionRows = assignmentIds.isEmpty() ? List.of() : submissions.findAllByAssignment_IdInOrderBySubmittedAtDesc(assignmentIds).stream()
            .filter(s -> s.getStudent().getUserId().equals(studentId)).map(s -> new CourseProgressCalculator.SubmissionAttempt(s.getAssignment().getId(), s.getStatus().name(),
                s.getSubmittedAt(), s.getAiScore(), s.getTeacherScore())).toList();
        List<CourseProgressCalculator.LegacyQuizAttempt> legacyRows = assignmentIds.isEmpty() ? List.of() : quizAttempts.findAllByAssignmentIdInOrderBySubmittedAtDesc(assignmentIds).stream()
            .filter(a -> a.getStudentId().equals(studentId)).map(a -> new CourseProgressCalculator.LegacyQuizAttempt(a.getAssignmentId(), a.getScore(), a.getSubmittedAt())).toList();
        Set<Integer> completedIds = progress.findAllByStudent_UserIdAndLesson_Module_Course_CourseId(studentId, courseId).stream()
            .map(row -> row.getLesson().getLessonId()).collect(Collectors.toSet());
        List<CourseProgressCalculator.LessonUnit> lessonRows = courseLessons.stream().map(l -> new CourseProgressCalculator.LessonUnit(l.getLessonId(), l.getTitle())).toList();
        return calculator.calculate(lessonRows, completedIds, assignmentRows, submissionRows, legacyRows, LocalDateTime.now());
    }

    private Map<String,Object> progressView(CourseProgressCalculator.StudentProgress summary) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("completedLessons", summary.completedLessons()); result.put("totalLessons", summary.totalLessons()); result.put("lessonProgressPercent", summary.lessonProgressPercent());
        result.put("completedAssignments", summary.completedAssignments()); result.put("requiredAssignments", summary.requiredAssignments()); result.put("assignmentProgressPercent", summary.assignmentProgressPercent());
        result.put("overallProgressPercent", summary.overallProgressPercent()); result.put("overdueAssignments", summary.overdueAssignments());
        result.put("averageScorePercent", summary.averageScorePercent()); result.put("assignments", summary.assignments()); return result;
    }

    private void requireActiveEnrollment(int studentId, int courseId) {
        if (!enrollments.existsByStudent_UserIdAndCourse_CourseIdAndStatus(studentId, courseId, EnrollmentStatus.ACTIVE))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn cần ghi danh ACTIVE để cập nhật tiến độ học.");
    }
    private int actorId(Authentication auth) { return Integer.parseInt(auth.getName()); }
}
