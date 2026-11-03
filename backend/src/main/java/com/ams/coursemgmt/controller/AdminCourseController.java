package com.ams.coursemgmt.controller;

import com.ams.assignment.entity.Assignment;
import com.ams.assignment.entity.Submission;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseModule;
import com.ams.coursemgmt.entity.CourseStatus;
import com.ams.coursemgmt.repository.CourseModuleRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.coursemgmt.repository.LessonRepository;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.Payment;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.ams.enrollment.repository.PaymentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/admin/courses")
public class AdminCourseController {

    private final CourseRepository courseRepository;
    private final CourseModuleRepository moduleRepository;
    private final LessonRepository lessonRepository;
    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    public AdminCourseController(CourseRepository courseRepository,
                                 CourseModuleRepository moduleRepository,
                                 LessonRepository lessonRepository,
                                 AssignmentRepository assignmentRepository,
                                 SubmissionRepository submissionRepository,
                                 EnrollmentRepository enrollmentRepository,
                                 PaymentRepository paymentRepository,
                                 UserRepository userRepository) {
        this.courseRepository = courseRepository;
        this.moduleRepository = moduleRepository;
        this.lessonRepository = lessonRepository;
        this.assignmentRepository = assignmentRepository;
        this.submissionRepository = submissionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
    }

    public record CourseStatusUpdateRequest(String status) {}

    public record AdminCourseCreateRequest(
            String courseCode,
            String title,
            String subject,
            String targetAudience,
            String description,
            BigDecimal price,
            Integer teacherId,
            String status
    ) {}

    @GetMapping("/overview")
    @Transactional(readOnly = true)
    public Map<String, Object> getCoursesOverview() {
        List<Course> allCourses = courseRepository.findAllByOrderByCreatedAtDesc();

        long totalCourses = allCourses.size();
        long openCourses = allCourses.stream().filter(c -> c.getStatus() == CourseStatus.PUBLISHED).count();
        long pendingCourses = allCourses.stream().filter(c -> c.getStatus() == CourseStatus.DRAFT).count();
        long pausedCourses = allCourses.stream().filter(c -> c.getStatus() == CourseStatus.ARCHIVED).count();
        long paidCourses = allCourses.stream().filter(c -> c.getPrice() != null && c.getPrice().compareTo(BigDecimal.ZERO) > 0).count();

        List<Map<String, Object>> courseList = new ArrayList<>();
        for (Course c : allCourses) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("courseId", c.getCourseId());
            item.put("courseCode", c.getCourseCode());
            item.put("title", c.getTitle());
            item.put("subject", c.getSubject());
            item.put("targetAudience", c.getTargetAudience());
            item.put("description", c.getDescription());
            item.put("price", c.getPrice());
            item.put("status", c.getStatus().name());
            item.put("createdAt", c.getCreatedAt());

            User teacher = c.getTeacher();
            item.put("teacherId", teacher != null ? teacher.getUserId() : null);
            item.put("teacherName", teacher != null ? teacher.getFullName() : "Chưa phân công");
            item.put("teacherEmail", teacher != null ? teacher.getEmail() : "");
            item.put("teacherFaculty", teacher != null ? "Khoa CNTT" : "—");

            long moduleCount = moduleRepository.countByCourse_CourseId(c.getCourseId());
            long assignmentCount = assignmentRepository.countBySubjectId(c.getCourseId());

            item.put("moduleCount", moduleCount);
            item.put("assignmentCount", assignmentCount);

            courseList.add(item);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalCourses", totalCourses);
        summary.put("openCourses", openCourses);
        summary.put("pendingCourses", pendingCourses);
        summary.put("pausedCourses", pausedCourses);
        summary.put("paidCourses", paidCourses);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", summary);
        response.put("courses", courseList);

        return response;
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable Integer id,
                                                            @RequestBody CourseStatusUpdateRequest req) {
        Course course = courseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học"));

        try {
            CourseStatus newStatus = CourseStatus.valueOf(req.status().toUpperCase());
            course.setStatus(newStatus);
            courseRepository.save(course);
            return ResponseEntity.ok(Map.of(
                    "message", "Cập nhật trạng thái thành công",
                    "courseId", course.getCourseId(),
                    "status", newStatus.name()
            ));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ: " + req.status());
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> createCourse(@RequestBody AdminCourseCreateRequest req) {
        if (req.courseCode() == null || req.courseCode().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã khóa học không được để trống");
        }
        if (req.title() == null || req.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên khóa học không được để trống");
        }
        if (courseRepository.existsByCourseCodeIgnoreCase(req.courseCode().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã khóa học đã tồn tại");
        }

        User teacher = null;
        if (req.teacherId() != null) {
            teacher = userRepository.findById(req.teacherId()).orElse(null);
        }
        if (teacher == null) {
            teacher = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == User.Role.TEACHER)
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hệ thống chưa có giảng viên"));
        }

        Course course = new Course();
        course.setCourseCode(req.courseCode().trim().toUpperCase());
        course.setTitle(req.title().trim());
        course.setSubject(req.subject() != null ? req.subject().trim() : "Công nghệ Thông tin");
        course.setTargetAudience(req.targetAudience() != null ? req.targetAudience().trim() : "Sinh viên đại học");
        course.setDescription(req.description() != null ? req.description().trim() : "");
        course.setPrice(req.price() != null ? req.price() : BigDecimal.ZERO);
        course.setTeacher(teacher);

        CourseStatus initialStatus = CourseStatus.PUBLISHED;
        if (req.status() != null && !req.status().isBlank()) {
            try {
                initialStatus = CourseStatus.valueOf(req.status().toUpperCase());
            } catch (Exception ignored) {}
        }
        course.setStatus(initialStatus);

        Course saved = courseRepository.save(course);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "courseId", saved.getCourseId(),
                "courseCode", saved.getCourseCode(),
                "title", saved.getTitle(),
                "status", saved.getStatus().name()
        ));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteCourse(@PathVariable Integer id) {
        Course course = courseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khóa học"));

        // 1. Delete all payments & enrollments for this course
        List<Enrollment> courseEnrollments = enrollmentRepository.findAllByCourse_CourseIdOrderByCreatedAtAsc(id);
        if (!courseEnrollments.isEmpty()) {
            List<Long> enrollmentIds = courseEnrollments.stream().map(Enrollment::getId).toList();
            List<Payment> paymentsToDelete = paymentRepository.findAllByEnrollment_IdInOrderByCreatedAtDescIdDesc(enrollmentIds);
            if (!paymentsToDelete.isEmpty()) {
                paymentRepository.deleteAll(paymentsToDelete);
            }
            enrollmentRepository.deleteAll(courseEnrollments);
        }

        // 2. Delete all submissions and assignments for this course
        List<Assignment> courseAssignments = assignmentRepository.findAllBySubjectId(id);
        for (Assignment a : courseAssignments) {
            List<Submission> submissions = submissionRepository.findAllByAssignment_IdOrderBySubmittedAtAsc(a.getId());
            if (!submissions.isEmpty()) {
                submissionRepository.deleteAll(submissions);
            }
        }
        if (!courseAssignments.isEmpty()) {
            assignmentRepository.deleteAll(courseAssignments);
        }

        // 3. Delete all lessons and modules for this course
        List<CourseModule> modules = moduleRepository.findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(id);
        for (CourseModule m : modules) {
            lessonRepository.deleteAllByModule_ModuleId(m.getModuleId());
        }
        if (!modules.isEmpty()) {
            moduleRepository.deleteAll(modules);
        }

        // 4. Finally delete the course itself
        courseRepository.delete(course);
        return ResponseEntity.noContent().build();
    }
}
