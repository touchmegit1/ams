package com.ams.teacher;

import com.ams.assignment.repository.AssignmentRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.auth.entity.User;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.repository.CourseModuleRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.entity.Payment;
import com.ams.enrollment.entity.PaymentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.ams.enrollment.repository.PaymentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TeacherWorkspaceService {
    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final EnrollmentRepository enrollments;
    private final PaymentRepository payments;
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;

    public TeacherWorkspaceService(CourseRepository courses, CourseModuleRepository modules, EnrollmentRepository enrollments,
                                   PaymentRepository payments, AssignmentRepository assignments,
                                   SubmissionRepository submissions) {
        this.courses = courses; this.modules = modules; this.enrollments = enrollments; this.payments = payments;
        this.assignments = assignments; this.submissions = submissions;
    }

    public List<Map<String, Object>> listCourses(Authentication auth) {
        List<Course> owned = isAdmin(auth) ? courses.findAllByOrderByCreatedAtDesc()
            : courses.findAllByTeacher_UserIdOrderByCreatedAtDesc(userId(auth));
        return owned.stream().map(course -> {
            List<Enrollment> roster = enrollments.findAllByCourse_CourseIdOrderByCreatedAtAsc(course.getCourseId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("courseId", course.getCourseId()); row.put("courseCode", nullSafe(course.getCourseCode()));
            row.put("title", course.getTitle()); row.put("subject", nullSafe(course.getSubject()));
            row.put("description", nullSafe(course.getDescription())); row.put("price", course.getPrice()); row.put("status", course.getStatus());
            row.put("studentCount", roster.stream().filter(e -> e.getStatus() == EnrollmentStatus.ACTIVE).count());
            row.put("modulesCount", modules.countByCourse_CourseId(course.getCourseId()));
            row.put("assignmentCount", assignments.count((root, query, cb) -> cb.equal(root.get("subjectId"), course.getCourseId())));
            var pendingSubs = submissions.findAllByAssignment_SubjectIdAndStatusNot(course.getCourseId(), com.ams.assignment.entity.Submission.Status.TEACHER_REVIEWED);
            row.put("pendingReviewCount", (long) pendingSubs.size());
            Integer firstPendingAssignmentId = null;
            Map<Integer, Map<String, Object>> pendingMap = new LinkedHashMap<>();
            for (var s : pendingSubs) {
                var a = s.getAssignment();
                if (firstPendingAssignmentId == null) firstPendingAssignmentId = a.getId();
                pendingMap.computeIfAbsent(a.getId(), aId -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", a.getId());
                    item.put("title", a.getTitle());
                    item.put("pendingCount", 0L);
                    return item;
                });
                var item = pendingMap.get(a.getId());
                item.put("pendingCount", (Long) item.get("pendingCount") + 1L);
            }
            row.put("firstPendingAssignmentId", firstPendingAssignmentId);
            row.put("pendingAssignments", new ArrayList<>(pendingMap.values()));
            return row;
        }).toList();
    }

    public List<Map<String, Object>> students(Integer courseId, Authentication auth) {
        Course course = requireCourse(courseId, auth);
        List<Enrollment> roster = enrollments.findAllByCourse_CourseIdOrderByCreatedAtAsc(course.getCourseId());
        List<Long> enrollmentIds = roster.stream().map(Enrollment::getId).toList();
        List<Payment> coursePayments = enrollmentIds.isEmpty() ? List.of() : payments.findAllByEnrollment_IdInOrderByCreatedAtDescIdDesc(enrollmentIds);
        Map<Long, List<Payment>> paymentMap = coursePayments.stream()
            .collect(Collectors.groupingBy(payment -> payment.getEnrollment().getId()));
        List<Map<String, Object>> result = new ArrayList<>();
        for (Enrollment enrollment : roster) {
            User student = enrollment.getStudent();
            List<Payment> attempts = paymentMap.getOrDefault(enrollment.getId(), List.of());
            Payment latestPaid = attempts.stream().filter(p -> p.getStatus() == PaymentStatus.PAID).findFirst().orElse(null);
            Payment latest = attempts.stream().findFirst().orElse(null);
            String paymentStatus = paymentStatus(course, enrollment, latestPaid, latest);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("studentId", student.getUserId()); row.put("fullName", student.getFullName()); row.put("email", student.getEmail());
            row.put("enrollmentStatus", enrollment.getStatus()); row.put("paymentStatus", paymentStatus);
            row.put("paidAmount", latestPaid == null ? BigDecimal.ZERO : latestPaid.getAmount());
            row.put("enrolledAt", enrollment.getCreatedAt()); row.put("activatedAt", enrollment.getActivatedAt());
            result.add(row);
        }
        return result;
    }

    public Map<String, Object> paymentSummary(Integer courseId, Authentication auth) {
        Course course = requireCourse(courseId, auth);
        List<Enrollment> roster = enrollments.findAllByCourse_CourseIdOrderByCreatedAtAsc(course.getCourseId());
        List<Long> ids = roster.stream().map(Enrollment::getId).toList();
        List<Payment> coursePayments = ids.isEmpty() ? List.of() : payments.findAllByEnrollment_IdInOrderByCreatedAtDescIdDesc(ids);
        Map<Long, Payment> latestPaidByEnrollment = coursePayments.stream()
            .filter(payment -> payment.getStatus() == PaymentStatus.PAID)
            .collect(Collectors.toMap(payment -> payment.getEnrollment().getId(), payment -> payment, (first, ignored) -> first));
        BigDecimal paid = latestPaidByEnrollment.values().stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pending = sum(coursePayments, PaymentStatus.PENDING);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("paidAmount", paid); result.put("pendingAmount", pending);
        result.put("paidCount", latestPaidByEnrollment.size());
        result.put("pendingCount", coursePayments.stream().filter(p -> p.getStatus() == PaymentStatus.PENDING).count());
        result.put("payments", roster.stream().map(enrollment -> {
            List<Payment> attempts = coursePayments.stream().filter(p -> p.getEnrollment().getId().equals(enrollment.getId())).toList();
            Payment latestPaid = attempts.stream().filter(p -> p.getStatus() == PaymentStatus.PAID).findFirst().orElse(null);
            Payment latest = attempts.stream().findFirst().orElse(null);
            Map<String, Object> row = new LinkedHashMap<>(); row.put("studentId", enrollment.getStudent().getUserId());
            row.put("studentName", enrollment.getStudent().getFullName()); row.put("status", paymentStatus(course, enrollment, latestPaid, latest));
            row.put("amount", latestPaid == null ? BigDecimal.ZERO : latestPaid.getAmount()); row.put("paidAt", latestPaid == null ? null : latestPaid.getPaidAt());
            return row;
        }).toList());
        return result;
    }

    private String paymentStatus(Course course, Enrollment enrollment, Payment latestPaid, Payment latest) {
        if (latestPaid != null) return "PAID";
        if (course.getPrice().signum() > 0 && enrollment.getStatus() == EnrollmentStatus.ACTIVE) return "NOT_COLLECTED";
        if (latest != null) return latest.getStatus().name();
        return "FREE";
    }

    public Course requireCourse(Integer id, Authentication auth) {
        Course course = courses.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học"));
        if (!isAdmin(auth) && !course.getTeacher().getUserId().equals(userId(auth)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không phụ trách khóa học này");
        return course;
    }

    private BigDecimal sum(List<Payment> payments, PaymentStatus status) {
        return payments.stream().filter(payment -> payment.getStatus() == status).map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    private boolean isAdmin(Authentication auth) { return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")); }
    private Integer userId(Authentication auth) { return Integer.valueOf(auth.getName()); }
    private String nullSafe(String value) { return value == null ? "" : value; }
}
