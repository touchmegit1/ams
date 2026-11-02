package com.ams.enrollment.service;

import com.ams.assignment.repository.QuizAttemptRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.repository.EnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class CourseStudentService {
    private final CourseRepository courses;
    private final UserRepository users;
    private final EnrollmentRepository enrollments;
    private final QuizAttemptRepository attempts;

    public List<Map<String, Object>> list(Integer courseId, Authentication auth) {
        int actorId = Integer.parseInt(auth.getName());
        User actor = users.findById(actorId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var course = courses.findById(courseId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học"));
        if (actor.getRole() != User.Role.ADMIN && (actor.getRole() != User.Role.TEACHER || !course.getTeacher().getUserId().equals(actorId)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học");
        return enrollments.findAllByCourse_CourseIdOrderByCreatedAtDesc(courseId).stream().map(enrollment -> {
            var student = enrollment.getStudent();
            var history = attempts.findCourseAttempts(courseId, student.getUserId());
            BigDecimal average = history.isEmpty() ? BigDecimal.ZERO : history.stream().map(a -> a.getScore())
                .reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(history.size()), 2, java.math.RoundingMode.HALF_UP);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("studentId", student.getUserId()); row.put("fullName", student.getFullName()); row.put("email", student.getEmail());
            row.put("status", enrollment.getStatus()); row.put("createdAt", enrollment.getCreatedAt()); row.put("activatedAt", enrollment.getActivatedAt());
            row.put("quizAttempts", history.size()); row.put("averageScore", average);
            return row;
        }).toList();
    }
}
