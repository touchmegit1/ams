package com.ams.assignment;

import com.ams.assignment.entity.Assignment;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.JwtTokenProvider;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseStatus;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.assignment.repository.SubmissionFileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.config.import=", "spring.profiles.active=dev", "spring.datasource.url=jdbc:h2:mem:submission_workflow_tests;DB_CLOSE_DELAY=-1;MODE=MySQL", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "gemini.api-key=", "assignment.storage-dir=target/submission-workflow-files"})
@AutoConfigureMockMvc
class SubmissionWorkflowIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired CourseRepository courses;
    @Autowired AssignmentRepository assignments;
    @Autowired EnrollmentRepository enrollments;
    @Autowired SubmissionRepository submissions;
    @Autowired SubmissionFileRepository files;
    @Autowired JwtTokenProvider jwt;

    User teacherUser, studentUser, otherTeacherUser;
    Course course;
    Assignment assignment;
    String teacherToken, studentToken, otherTeacherToken;

    @BeforeEach void setup() throws Exception {
        files.deleteAll(); submissions.deleteAll(); enrollments.deleteAll(); assignments.deleteAll(); courses.deleteAll(); users.deleteAll();
        teacherUser = account("teacher", User.Role.TEACHER);
        studentUser = account("student", User.Role.STUDENT);
        otherTeacherUser = account("other", User.Role.TEACHER);
        teacherToken = token(teacherUser); studentToken = token(studentUser); otherTeacherToken = token(otherTeacherUser);

        course = new Course(); course.setTeacher(teacherUser); course.setTitle("Java"); course.setStatus(CourseStatus.PUBLISHED); course = courses.save(course);
        Enrollment enrollment = new Enrollment(); enrollment.setCourse(course); enrollment.setStudent(studentUser); enrollment.setStatus(EnrollmentStatus.ACTIVE); enrollments.save(enrollment);

        assignment = new Assignment(); assignment.setSubjectId(course.getCourseId()); assignment.setCreatedBy(teacherUser.getUserId());
        assignment.setTitle("Quiz"); assignment.setDescription("Chọn đáp án"); assignment.setStatus(Assignment.Status.PUBLISHED);
        assignment.setAssignmentType("QUIZ"); assignment.setQuestionsJson(json.writeValueAsString(List.of(Map.of("text", "Câu hỏi", "type", "MULTIPLE", "options", List.of("A", "B", "C", "D"), "correctAnswers", List.of(0, 2)))));
        assignment.setRubricJson("[{\"criteria\":\"Kiến thức\",\"description\":\"Đúng đáp án\",\"weight\":100}]");
        assignment.setMaxScore(new BigDecimal("10")); assignment.setDueDate(LocalDateTime.now().plusDays(1)); assignment = assignments.save(assignment);
    }

    @Test void studentGetsPartialQuizScoreAndTeacherOverrideBecomesOfficial() throws Exception {
        String response = mvc.perform(multipart("/api/student/assignments/{id}/submissions", assignment.getId())
                .param("answersJson", "[[0,1,2]]").param("notes", "My answer")
                .header("Authorization", studentToken))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("status").value("EVALUATED"))
            .andExpect(jsonPath("attemptNumber").value(1))
            .andExpect(jsonPath("aiScore").value(5.0))
            .andReturn().getResponse().getContentAsString();
        int submissionId = json.readTree(response).get("id").asInt();

        mvc.perform(get("/api/student/assignments/{id}", assignment.getId()).header("Authorization", studentToken))
            .andExpect(status().isOk()).andExpect(jsonPath("questions[0].correctAnswers").doesNotExist());
        mvc.perform(get("/api/student/submissions/{id}", submissionId).header("Authorization", studentToken))
            .andExpect(status().isOk()).andExpect(jsonPath("officialScore").doesNotExist());
        mvc.perform(get("/api/assignments/{id}/submissions", assignment.getId()).header("Authorization", otherTeacherToken))
            .andExpect(status().isForbidden());

        mvc.perform(patch("/api/assignments/{assignmentId}/submissions/{submissionId}/review", assignment.getId(), submissionId)
                .header("Authorization", teacherToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"score\":8.5,\"feedback\":\"Đã duyệt\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("status").value("TEACHER_REVIEWED"))
            .andExpect(jsonPath("officialScore").value(8.5));
        mvc.perform(get("/api/student/submissions/{id}", submissionId).header("Authorization", studentToken))
            .andExpect(status().isOk()).andExpect(jsonPath("officialScore").value(8.5));
    }

    @Test void documentSubmissionPersistsWhenAiIsNotConfiguredAndRejectsOtherStudents() throws Exception {
        assignment.setAssignmentType("DOCUMENT"); assignment.setQuestionsJson("[]"); assignment.setAllowedFileTypes("TXT"); assignments.saveAndFlush(assignment);
        MockMultipartFile file = new MockMultipartFile("files", "report.txt", "text/plain", "Assignment evidence".getBytes());
        String response = mvc.perform(multipart("/api/student/assignments/{id}/submissions", assignment.getId())
                .file(file).param("notes", "Optional notes").header("Authorization", studentToken))
            .andExpect(status().isCreated()).andExpect(jsonPath("status").value("AI_FAILED"))
            .andExpect(jsonPath("evaluationMessage").isNotEmpty())
            .andReturn().getResponse().getContentAsString();
        int submissionId = json.readTree(response).get("id").asInt();
        int fileId = json.readTree(response).get("files").get(0).get("id").asInt();

        mvc.perform(get("/api/student/submissions/{id}", submissionId).header("Authorization", otherTeacherToken))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/student/submissions/{submissionId}/files/{fileId}", submissionId, fileId).header("Authorization", studentToken))
            .andExpect(status().isOk());
        mvc.perform(get("/api/student/submissions/{submissionId}/files/{fileId}", submissionId, fileId).header("Authorization", otherTeacherToken))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/student/submissions/{submissionId}/files/{fileId}", submissionId, fileId).header("Authorization", teacherToken))
            .andExpect(status().isOk());
        mvc.perform(get("/api/assignments/{id}/submissions", assignment.getId()).header("Authorization", teacherToken))
            .andExpect(status().isOk()).andExpect(jsonPath("content[0].attemptNumber").value(1));
    }

    @Test void resubmissionKeepsAttemptsAndDeadlineClosesTheAssignment() throws Exception {
        for (int attempt = 1; attempt <= 2; attempt++) {
            mvc.perform(multipart("/api/student/assignments/{id}/submissions", assignment.getId())
                    .param("answersJson", "[[0,2]]").header("Authorization", studentToken))
                .andExpect(status().isCreated()).andExpect(jsonPath("attemptNumber").value(attempt));
        }
        mvc.perform(get("/api/student/assignments/{id}/submissions", assignment.getId()).header("Authorization", studentToken))
            .andExpect(status().isOk()).andExpect(jsonPath("attempts.length()" ).value(2)).andExpect(jsonPath("latest.attemptNumber").value(2));
        assignment.setDueDate(LocalDateTime.now().minusSeconds(1)); assignments.saveAndFlush(assignment);
        mvc.perform(multipart("/api/student/assignments/{id}/submissions", assignment.getId())
                .param("answersJson", "[[0,2]]").header("Authorization", studentToken))
            .andExpect(status().isConflict());
    }

    @Test void rejectsMoreThanFiveFiles() throws Exception {
        assignment.setAssignmentType("DOCUMENT"); assignment.setQuestionsJson("[]"); assignment.setAllowedFileTypes("TXT"); assignments.saveAndFlush(assignment);
        MockMultipartHttpServletRequestBuilder request = multipart("/api/student/assignments/{id}/submissions", assignment.getId());
        request.header("Authorization", studentToken);
        for (int i = 0; i < 6; i++) request.file(new MockMultipartFile("files", "f" + i + ".txt", "text/plain", ("text" + i).getBytes()));
        mvc.perform(request).andExpect(status().isBadRequest());
    }

    @Test void rejectsFileWhoseContentsDoNotMatchItsExtension() throws Exception {
        assignment.setAssignmentType("DOCUMENT"); assignment.setQuestionsJson("[]"); assignment.setAllowedFileTypes("TXT"); assignments.saveAndFlush(assignment);
        MockMultipartFile invalid = new MockMultipartFile("files", "report.txt", "text/plain", new byte[] { 0, 1, 2 });
        mvc.perform(multipart("/api/student/assignments/{id}/submissions", assignment.getId()).file(invalid).header("Authorization", studentToken))
            .andExpect(status().isBadRequest());
    }

    private User account(String name, User.Role role) {
        return users.save(User.builder().fullName(name).email(name + "@test.local").role(role).isVerified(true).build());
    }
    private String token(User user) {
        return "Bearer " + jwt.generateToken(user.getUserId(), user.getEmail(), user.getRole().name(), user.getAuthVersion());
    }
}
