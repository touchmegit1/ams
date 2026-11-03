package com.ams.enrollment.service;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.entity.Payment;
import com.ams.enrollment.entity.PaymentStatus;
import com.ams.enrollment.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
public class AdminPaymentService {
    private final PaymentRepository payments;
    private final CourseRepository courses;
    private final UserRepository users;

    public AdminPaymentService(PaymentRepository payments, CourseRepository courses, UserRepository users) {
        this.payments = payments;
        this.courses = courses;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getFinancialOverview() {
        List<Payment> allPayments = payments.findAllByOrderByCreatedAtDesc();
        List<Course> allCourses = courses.findAll();
        List<User> allTeachers = users.findAll().stream()
                .filter(u -> u.getRole() == User.Role.TEACHER)
                .toList();

        BigDecimal totalRevenue = BigDecimal.ZERO;
        long paidCount = 0;
        long pendingCount = 0;

        for (Payment p : allPayments) {
            if (p.getStatus() == PaymentStatus.PAID) {
                totalRevenue = totalRevenue.add(p.getAmount());
                paidCount++;
            } else if (p.getStatus() == PaymentStatus.PENDING) {
                pendingCount++;
            }
        }

        // 1. By Teacher
        Map<Integer, Map<String, Object>> teacherMap = new LinkedHashMap<>();
        for (User t : allTeachers) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("teacherId", t.getUserId());
            item.put("teacherName", t.getFullName());
            item.put("email", t.getEmail());
            item.put("courseCount", 0);
            item.put("paidCount", 0L);
            item.put("revenue", BigDecimal.ZERO);
            teacherMap.put(t.getUserId(), item);
        }

        // Count courses per teacher
        for (Course c : allCourses) {
            if (c.getTeacher() != null) {
                Integer tId = c.getTeacher().getUserId();
                teacherMap.computeIfAbsent(tId, id -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("teacherId", id);
                    item.put("teacherName", c.getTeacher().getFullName());
                    item.put("email", c.getTeacher().getEmail());
                    item.put("courseCount", 0);
                    item.put("paidCount", 0L);
                    item.put("revenue", BigDecimal.ZERO);
                    return item;
                });
                var item = teacherMap.get(tId);
                item.put("courseCount", (Integer) item.get("courseCount") + 1);
            }
        }

        // 2. By Course
        Map<Integer, Map<String, Object>> courseMap = new LinkedHashMap<>();
        for (Course c : allCourses) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("courseId", c.getCourseId());
            item.put("courseCode", c.getCourseCode());
            item.put("courseTitle", c.getTitle());
            item.put("teacherName", c.getTeacher() != null ? c.getTeacher().getFullName() : "—");
            item.put("teacherId", c.getTeacher() != null ? c.getTeacher().getUserId() : null);
            item.put("price", c.getPrice());
            item.put("paidCount", 0L);
            item.put("pendingCount", 0L);
            item.put("revenue", BigDecimal.ZERO);
            courseMap.put(c.getCourseId(), item);
        }

        // 3. Transactions List
        List<Map<String, Object>> txList = new ArrayList<>();
        for (Payment p : allPayments) {
            var enrollment = p.getEnrollment();
            var course = enrollment != null ? enrollment.getCourse() : null;
            var student = enrollment != null ? enrollment.getStudent() : null;
            var teacher = course != null ? course.getTeacher() : null;

            if (p.getStatus() == PaymentStatus.PAID) {
                if (teacher != null && teacherMap.containsKey(teacher.getUserId())) {
                    var tItem = teacherMap.get(teacher.getUserId());
                    tItem.put("paidCount", (Long) tItem.get("paidCount") + 1);
                    tItem.put("revenue", ((BigDecimal) tItem.get("revenue")).add(p.getAmount()));
                }
                if (course != null && courseMap.containsKey(course.getCourseId())) {
                    var cItem = courseMap.get(course.getCourseId());
                    cItem.put("paidCount", (Long) cItem.get("paidCount") + 1);
                    cItem.put("revenue", ((BigDecimal) cItem.get("revenue")).add(p.getAmount()));
                }
            } else if (p.getStatus() == PaymentStatus.PENDING) {
                if (course != null && courseMap.containsKey(course.getCourseId())) {
                    var cItem = courseMap.get(course.getCourseId());
                    cItem.put("pendingCount", (Long) cItem.get("pendingCount") + 1);
                }
            }

            Map<String, Object> tx = new LinkedHashMap<>();
            tx.put("paymentId", p.getId());
            tx.put("orderCode", p.getOrderCode());
            tx.put("amount", p.getAmount());
            tx.put("status", p.getStatus().name());
            tx.put("createdAt", p.getCreatedAt());
            tx.put("paidAt", p.getPaidAt());
            tx.put("studentName", student != null ? student.getFullName() : "—");
            tx.put("studentEmail", student != null ? student.getEmail() : "—");
            tx.put("courseId", course != null ? course.getCourseId() : null);
            tx.put("courseTitle", course != null ? course.getTitle() : "—");
            tx.put("courseCode", course != null ? course.getCourseCode() : "—");
            tx.put("teacherName", teacher != null ? teacher.getFullName() : "—");
            txList.add(tx);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("paidTransactions", paidCount);
        summary.put("pendingTransactions", pendingCount);
        summary.put("totalCourses", allCourses.size());
        summary.put("totalTeachers", allTeachers.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("byTeacher", new ArrayList<>(teacherMap.values()));
        result.put("byCourse", new ArrayList<>(courseMap.values()));
        result.put("transactions", txList);

        return result;
    }
}
