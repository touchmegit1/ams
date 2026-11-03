package com.ams.enrollment.service;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseStatus;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.entity.Payment;
import com.ams.enrollment.entity.PaymentStatus;
import com.ams.enrollment.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

        // 1. By Teacher Map
        Map<Integer, Map<String, Object>> teacherMap = new LinkedHashMap<>();
        for (User t : allTeachers) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("teacherId", t.getUserId());
            item.put("teacherName", t.getFullName());
            item.put("email", t.getEmail());
            item.put("faculty", "Khoa CNTT");
            item.put("courseCount", 0);
            item.put("paidCount", 0L);
            item.put("revenue", BigDecimal.ZERO);
            item.put("teacherShare", BigDecimal.ZERO);
            item.put("platformShare", BigDecimal.ZERO);
            item.put("courses", new ArrayList<Map<String, Object>>());
            teacherMap.put(t.getUserId(), item);
        }

        // 2. By Course Map
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
            item.put("teacherShare", BigDecimal.ZERO);
            item.put("platformShare", BigDecimal.ZERO);
            item.put("status", c.getStatus() == CourseStatus.PUBLISHED ? "Hoạt động" : "Tạm dừng");
            courseMap.put(c.getCourseId(), item);

            // Add teacher course reference
            if (c.getTeacher() != null) {
                Integer tId = c.getTeacher().getUserId();
                teacherMap.computeIfAbsent(tId, id -> {
                    Map<String, Object> tItem = new LinkedHashMap<>();
                    tItem.put("teacherId", id);
                    tItem.put("teacherName", c.getTeacher().getFullName());
                    tItem.put("email", c.getTeacher().getEmail());
                    tItem.put("faculty", "Khoa CNTT");
                    tItem.put("courseCount", 0);
                    tItem.put("paidCount", 0L);
                    tItem.put("revenue", BigDecimal.ZERO);
                    tItem.put("teacherShare", BigDecimal.ZERO);
                    tItem.put("platformShare", BigDecimal.ZERO);
                    tItem.put("courses", new ArrayList<Map<String, Object>>());
                    return tItem;
                });
                var tItem = teacherMap.get(tId);
                tItem.put("courseCount", (Integer) tItem.get("courseCount") + 1);
            }
        }

        // 3. Process Transactions
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
                    BigDecimal curRev = (BigDecimal) tItem.get("revenue");
                    tItem.put("revenue", curRev.add(p.getAmount()));
                }
                if (course != null && courseMap.containsKey(course.getCourseId())) {
                    var cItem = courseMap.get(course.getCourseId());
                    cItem.put("paidCount", (Long) cItem.get("paidCount") + 1);
                    BigDecimal curRev = (BigDecimal) cItem.get("revenue");
                    cItem.put("revenue", curRev.add(p.getAmount()));
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

        // 4. Compute 70/30 split on courses and teachers
        for (var cItem : courseMap.values()) {
            BigDecimal cRev = (BigDecimal) cItem.get("revenue");
            BigDecimal tShare = cRev.multiply(new BigDecimal("0.70")).setScale(0, RoundingMode.HALF_UP);
            BigDecimal pShare = cRev.multiply(new BigDecimal("0.30")).setScale(0, RoundingMode.HALF_UP);
            cItem.put("teacherShare", tShare);
            cItem.put("platformShare", pShare);

            Integer tId = (Integer) cItem.get("teacherId");
            if (tId != null && teacherMap.containsKey(tId)) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> teacherCourses = (List<Map<String, Object>>) teacherMap.get(tId).get("courses");
                teacherCourses.add(cItem);
            }
        }

        long teachersWithRevenue = 0;
        for (var tItem : teacherMap.values()) {
            BigDecimal tRev = (BigDecimal) tItem.get("revenue");
            BigDecimal tShare = tRev.multiply(new BigDecimal("0.70")).setScale(0, RoundingMode.HALF_UP);
            BigDecimal pShare = tRev.multiply(new BigDecimal("0.30")).setScale(0, RoundingMode.HALF_UP);
            tItem.put("teacherShare", tShare);
            tItem.put("platformShare", pShare);
            if (tRev.compareTo(BigDecimal.ZERO) > 0) {
                teachersWithRevenue++;
            }
        }

        BigDecimal teacherRevenue = totalRevenue.multiply(new BigDecimal("0.70")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal platformRevenue = totalRevenue.multiply(new BigDecimal("0.30")).setScale(0, RoundingMode.HALF_UP);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("teacherRevenue", teacherRevenue);
        summary.put("platformRevenue", platformRevenue);
        summary.put("teachersWithRevenue", teachersWithRevenue);
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
