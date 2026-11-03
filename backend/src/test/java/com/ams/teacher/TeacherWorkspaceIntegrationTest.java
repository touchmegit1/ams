package com.ams.teacher;

import com.ams.assignment.entity.Assignment;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.JwtTokenProvider;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseStatus;
import com.ams.coursemgmt.repository.CourseModuleRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.entity.Payment;
import com.ams.enrollment.entity.PaymentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.ams.enrollment.repository.PaymentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockPart;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.config.import=", "spring.profiles.active=dev", "spring.datasource.url=jdbc:h2:mem:teacher_workspace_tests;DB_CLOSE_DELAY=-1;MODE=MySQL", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "gemini.api-key=", "assignments.deadline-check-ms=3600000", "ams.upload-dir=${java.io.tmpdir}/ams-teacher-workspace-tests"})
@AutoConfigureMockMvc
class TeacherWorkspaceIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired CourseRepository courses;
    @Autowired CourseModuleRepository modules;
    @Autowired AssignmentRepository assignments;
    @Autowired SubmissionRepository submissions;
    @Autowired EnrollmentRepository enrollments;
    @Autowired PaymentRepository payments;
    @Autowired JwtTokenProvider jwt;
    @Autowired PasswordEncoder passwordEncoder;

    String teacher;
    String otherTeacher;
    String student;
    Integer courseId;
    Long enrollmentId;

    @BeforeEach void setup() {
        submissions.deleteAll(); payments.deleteAll(); enrollments.deleteAll(); assignments.deleteAll(); modules.deleteAll(); courses.deleteAll(); users.deleteAll();
        User owner = account("teacher", User.Role.TEACHER);
        teacher = token(owner);
        otherTeacher = token(account("other", User.Role.TEACHER));
        User learner = account("student", User.Role.STUDENT);
        student = token(learner);

        Course course = new Course();
        course.setTeacher(owner); course.setCourseCode("CLASS-101"); course.setTitle("Lập trình REST");
        course.setSubject("Công nghệ phần mềm"); course.setPrice(new BigDecimal("100000")); course.setStatus(CourseStatus.PUBLISHED);
        courseId = courses.save(course).getCourseId();

        Enrollment enrollment = new Enrollment();
        enrollment.setStudent(learner); enrollment.setCourse(courses.findById(courseId).orElseThrow());
        enrollment.setStatus(EnrollmentStatus.ACTIVE); enrollment.setActivatedAt(Instant.now());
        enrollmentId = enrollments.save(enrollment).getId();
        payment(enrollmentId, "100000", PaymentStatus.PAID);
        payment(enrollmentId, "100000", PaymentStatus.PAID);
        payment(enrollmentId, "100000", PaymentStatus.PENDING);
    }

    User account(String name, User.Role role) {
        return users.save(User.builder().fullName(name).email(name + "@workspace.test").role(role).isVerified(true).build());
    }

    String token(User user) {
        return "Bearer " + jwt.generateToken(user.getUserId(), user.getEmail(), user.getRole().name(), user.getAuthVersion());
    }

    void payment(Long id, String amount, PaymentStatus status) {
        Payment payment = new Payment(); payment.setEnrollment(enrollments.findById(id).orElseThrow());
        payment.setOrderCode("ORDER-" + status + "-" + payments.count()); payment.setAmount(new BigDecimal(amount));
        payment.setAccountNumber("private"); payment.setStatus(status); payment.setCreatedAt(Instant.now());
        payment.setExpiresAt(Instant.now().plusSeconds(300)); if (status == PaymentStatus.PAID) payment.setPaidAt(Instant.now());
        payments.save(payment);
    }

    Assignment publishedAssignment() {
        Assignment assignment = new Assignment(); assignment.setSubjectId(courseId); assignment.setTitle("REST API");
        assignment.setDescription("Xây dựng API"); assignment.setRubricJson("[]"); assignment.setMaxScore(BigDecimal.TEN);
        assignment.setDueDate(LocalDateTime.now().plusDays(1)); assignment.setStatus(Assignment.Status.PUBLISHED);
        assignment.setCreatedBy(users.findByEmail("teacher@workspace.test").orElseThrow().getUserId());
        assignment.setAllowedFileTypes("PDF"); assignment.setAssignmentType("DOCUMENT");
        return assignments.save(assignment);
    }

    @Test void teacherCourseWorkspaceShowsOnlyOwnedCoursesAndPaymentSummary() throws Exception {
        mvc.perform(get("/api/teacher/courses").header("Authorization", teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].courseId").value(courseId))
            .andExpect(jsonPath("$[0].studentCount").value(1))
            .andExpect(jsonPath("$[0].modulesCount").value(0));
        mvc.perform(get("/api/teacher/courses").header("Authorization", student)).andExpect(status().isForbidden());
        mvc.perform(get("/api/teacher/courses/{id}/students", courseId).header("Authorization", otherTeacher)).andExpect(status().isForbidden());
        mvc.perform(get("/api/teacher/courses/{id}/students", courseId).header("Authorization", teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].fullName").value("student"))
            .andExpect(jsonPath("$[0].enrollmentStatus").value("ACTIVE"))
            .andExpect(jsonPath("$[0].paymentStatus").value("PAID"));
        mvc.perform(get("/api/teacher/courses/{id}/payments", courseId).header("Authorization", teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("paidAmount").value(100000))
            .andExpect(jsonPath("pendingAmount").value(100000))
            .andExpect(jsonPath("paidCount").value(1))
            .andExpect(jsonPath("pendingCount").value(1))
            .andExpect(jsonPath("payments[0].orderCode").doesNotExist());
    }
    @Test void paidActiveEnrollmentWithoutPaymentIsReportedAsNotCollected() throws Exception {
        payments.deleteAll();
        mvc.perform(get("/api/teacher/courses/{id}/students", courseId).header("Authorization", teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].paymentStatus").value("NOT_COLLECTED"));
        mvc.perform(get("/api/teacher/courses/{id}/payments", courseId).header("Authorization", teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("payments[0].status").value("NOT_COLLECTED"));
    }

    @Test void enrolledStudentCanSubmitAndTeacherCanGradeButOthersCannot() throws Exception {
        Assignment assignment = publishedAssignment();
        MockMultipartFile file = new MockMultipartFile("file", "answer.pdf", "application/pdf", "%PDF-1.4 answer".getBytes());

        mvc.perform(multipart("/api/student/assignments/{id}/submission", assignment.getId())
                .file(file).part(new MockPart("submissionText", "My answer".getBytes())).header("Authorization", student))
            .andExpect(status().isCreated()).andExpect(jsonPath("status").value("SUBMITTED"))
            .andExpect(jsonPath("fileName").value("answer.pdf"));
        mvc.perform(get("/api/teacher/assignments/{id}/submissions", assignment.getId()).header("Authorization", otherTeacher))
            .andExpect(status().isForbidden());
        String response = mvc.perform(get("/api/teacher/assignments/{id}/submissions", assignment.getId()).header("Authorization", teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].studentName").value("student"))
            .andReturn().getResponse().getContentAsString();
        int submissionId = json.readTree(response).get(0).get("submissionId").asInt();
        mvc.perform(get("/api/teacher/submissions/{id}/file", submissionId).header("Authorization", otherTeacher)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/teacher/assignments/{assignmentId}/submissions/{submissionId}/grade", assignment.getId(), submissionId)
                .header("Authorization", teacher).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("score", 11, "feedback", "Quá điểm tối đa"))))
            .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/teacher/assignments/{assignmentId}/submissions/{submissionId}/grade", assignment.getId(), submissionId)
                .header("Authorization", teacher).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("score", 8, "feedback", "Tốt"))))
            .andExpect(status().isOk()).andExpect(jsonPath("status").value("TEACHER_REVIEWED"))
            .andExpect(jsonPath("teacherScore").value(8));
        mvc.perform(get("/api/student/assignments/{id}/submission", assignment.getId()).header("Authorization", student))
            .andExpect(status().isOk()).andExpect(jsonPath("teacherFeedback").value("Tốt"));
        mvc.perform(multipart("/api/student/assignments/{id}/submission", assignment.getId())
                .part(new MockPart("submissionText", "Thay đổi sau khi chấm".getBytes())).header("Authorization", student))
            .andExpect(status().isConflict());
    }

    @Test void freshlyLoggedInStudentCanSubmitMultipartUsingReturnedBearerToken() throws Exception {
        Assignment assignment = publishedAssignment();
        User learner = users.findByEmail("student@workspace.test").orElseThrow();
        learner.setPasswordHash(passwordEncoder.encode("student-password")); users.save(learner);
        String login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", learner.getEmail(), "password", "student-password"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String accessToken = "Bearer " + json.readTree(login).get("accessToken").asText();
        MockMultipartFile file = new MockMultipartFile("file", "fresh.pdf", "application/pdf", "%PDF-1.4 content".getBytes());
        mvc.perform(multipart("/api/student/assignments/{id}/submission", assignment.getId()).file(file)
                .part(new MockPart("submissionText", "fresh answer".getBytes())).header("Authorization", accessToken))
            .andExpect(status().isCreated()).andExpect(jsonPath("aiEvaluationStatus").value("PENDING"));
        mvc.perform(get("/api/student/assignments/{id}/submission", assignment.getId()).header("Authorization", accessToken))
            .andExpect(status().isOk()).andExpect(jsonPath("submissionText").value("fresh answer"))
            .andExpect(jsonPath("teacherScore").value(org.hamcrest.Matchers.nullValue())).andExpect(jsonPath("aiScore").doesNotExist());
        mvc.perform(get("/api/student/assignments").header("Authorization", accessToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].submissionStatus").value("SUBMITTED"));
    }

    @Test void studentSubmissionReadWithoutBearerReturnsSpecificAuthReason() throws Exception {
        Assignment assignment = publishedAssignment();
        mvc.perform(get("/api/student/assignments/{id}/submission", assignment.getId()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("message").value(org.hamcrest.Matchers.containsString("thiếu Bearer token")));
    }

    @Test void rejectsUnenrolledStudentAndUnallowedSubmissionFile() throws Exception {
        Assignment assignment = publishedAssignment();
        String outsider = token(account("outsider", User.Role.STUDENT));
        MockMultipartFile pdf = new MockMultipartFile("file", "answer.pdf", "application/pdf", "%PDF".getBytes());
        mvc.perform(multipart("/api/student/assignments/{id}/submission", assignment.getId()).file(pdf)
                .part(new MockPart("submissionText", "answer".getBytes())).header("Authorization", outsider))
            .andExpect(status().isForbidden());
        MockMultipartFile zip = new MockMultipartFile("file", "answer.zip", "application/zip", "zip".getBytes());
        mvc.perform(multipart("/api/student/assignments/{id}/submission", assignment.getId()).file(zip)
                .part(new MockPart("submissionText", "answer".getBytes())).header("Authorization", student))
            .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/student/assignments/{id}/submission", assignment.getId())
                .part(new MockPart("submissionText", "x".repeat(100_001).getBytes())).header("Authorization", student))
            .andExpect(status().isPayloadTooLarge());
    }
}
