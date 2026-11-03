package com.ams.enrollment.service;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseStatus;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.dto.EnrollmentResponse;
import com.ams.enrollment.entity.*;
import com.ams.enrollment.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Service
public class EnrollmentService {
    private final EnrollmentRepository enrollments;
    private final PaymentRepository payments;
    private final CourseRepository courses;
    private final UserRepository users;
    @Value("${sepay.bank:}") private String bank;

    public EnrollmentService(EnrollmentRepository enrollments, PaymentRepository payments,
            CourseRepository courses, UserRepository users) {
        this.enrollments = enrollments;
        this.payments = payments;
        this.courses = courses;
        this.users = users;
    }

    @Transactional
    public EnrollmentResponse enroll(Integer studentId, Integer courseId) {
        User student = requireStudent(studentId);
        Course course = courses.findLockedById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
        Enrollment enrollment = enrollments.findByStudent_UserIdAndCourse_CourseId(studentId, courseId).orElse(null);
        if (enrollment != null && enrollment.getStatus() == EnrollmentStatus.ACTIVE) return response(enrollment);
        if (course.getStatus() != CourseStatus.PUBLISHED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Course is not open for enrollment");
        }
        if (enrollment == null) {
            enrollment = new Enrollment();
            enrollment.setStudent(student);
            enrollment.setCourse(course);
            enrollment = enrollments.saveAndFlush(enrollment);
        }
        Payment latest = payments.findTopByEnrollment_IdOrderByCreatedAtDescIdDesc(enrollment.getId()).orElse(null);
        Instant now = Instant.now();
        if (latest != null && latest.getStatus() == PaymentStatus.PENDING) latest.setStatus(PaymentStatus.EXPIRED);
        enrollment.setStatus(EnrollmentStatus.ACTIVE);
        enrollment.setActivatedAt(now);
        return response(enrollment);
    }

    @Transactional(readOnly = true)
    public List<EnrollmentResponse> list(Integer studentId) {
        requireStudent(studentId);
        return enrollments.findAllByStudent_UserIdOrderByCreatedAtDesc(studentId).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public EnrollmentResponse get(Integer studentId, Long enrollmentId) {
        Enrollment enrollment = enrollments.findById(enrollmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found"));
        if (!enrollment.getStudent().getUserId().equals(studentId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found");
        }
        return response(enrollment);
    }

    private User requireStudent(Integer id) {
        User user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (user.getRole() != User.Role.STUDENT) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return user;
    }

    private EnrollmentResponse response(Enrollment enrollment) {
        Payment payment = payments.findTopByEnrollment_IdOrderByCreatedAtDescIdDesc(enrollment.getId()).orElse(null);
        return response(enrollment, payment);
    }

    private EnrollmentResponse response(Enrollment enrollment, Payment payment) {
        String status = enrollment.getStatus().name();
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING && !Instant.now().isBefore(payment.getExpiresAt())) {
            status = EnrollmentStatus.EXPIRED.name();
        }
        String paymentStatus = payment == null ? null : payment.getStatus().name();
        if (payment != null && status.equals("EXPIRED") && payment.getStatus() == PaymentStatus.PENDING) paymentStatus = "EXPIRED";
        String qr = payment == null || !status.equals("PENDING") ? null
                : "https://vietqr.app/img?acc=" + encode(payment.getAccountNumber()) + "&bank=" + encode(bank)
                + "&amount=" + payment.getAmount().toBigIntegerExact() + "&des=" + encode(payment.getOrderCode()) + "&template=compact";
        return new EnrollmentResponse(enrollment.getId(), enrollment.getCourse().getCourseId(),
                enrollment.getCourse().getTitle(), enrollment.getCourse().getTeacher().getFullName(), status, payment == null ? null : payment.getId(),
                paymentStatus, payment == null ? null : payment.getAmount(), payment == null ? null : payment.getOrderCode(),
                payment == null ? null : bank, payment == null ? null : payment.getAccountNumber(),
                payment == null ? null : payment.getOrderCode(), qr, payment == null ? null : payment.getExpiresAt());
    }

    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
