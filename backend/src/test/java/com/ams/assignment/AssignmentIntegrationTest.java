package com.ams.assignment;

import com.ams.assignment.entity.*;
import com.ams.assignment.repository.*;
import com.ams.assignment.config.AssignmentDeadlineJob;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.config.import=", "spring.profiles.active=dev", "spring.datasource.url=jdbc:h2:mem:assignment_tests;DB_CLOSE_DELAY=-1;MODE=MySQL", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false", "gemini.api-key=", "assignments.deadline-check-ms=3600000"})
@AutoConfigureMockMvc
class AssignmentIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired CourseRepository courses;
    @Autowired AssignmentRepository assignments;
    @Autowired AssignmentTemplateRepository templates;
    @Autowired JwtTokenProvider jwt;
    @Autowired AssignmentDeadlineJob job;
    @Autowired EnrollmentRepository enrollments;
    @Autowired com.ams.coursemgmt.repository.CourseRepository enrollmentCourses;
    String teacher,other,student,admin;
    Integer subjectId;
    @BeforeEach void setup() {
        enrollments.deleteAll(); assignments.deleteAll(); templates.deleteAll(); courses.deleteAll(); users.deleteAll();
        User t=account("teacher",User.Role.TEACHER);
        teacher=token(t); other=token(account("other",User.Role.TEACHER)); student=token(account("student",User.Role.STUDENT)); admin=token(account("admin",User.Role.ADMIN));
        Course c=new Course(); c.setTeacherId(t.getUserId()); c.setTitle("Lập trình Java"); subjectId=courses.save(c).getId();
    }
    User account(String name,User.Role role) { return users.save(User.builder().fullName(name).email(name+"@test.local").role(role).isVerified(true).build()); }
    String token(User user) { return "Bearer "+jwt.generateToken(user.getUserId(),user.getEmail(),user.getRole().name(),user.getAuthVersion()); }
    Map<String,Object> body() {
        Map<String,Object> m=new HashMap<>(); m.put("subjectId",subjectId); m.put("title","Bài tập REST API"); m.put("description","Xây dựng API và tài liệu sử dụng");
        m.put("dueDate",LocalDateTime.now().plusDays(2).toString()); m.put("maxScore",10); m.put("allowedFileTypes",List.of("PDF","ZIP")); m.put("source","MANUAL");
        m.put("rubric",List.of(Map.of("criteria","Chức năng","description","Đúng yêu cầu","weight",100))); return m;
    }
    int create(Map<String,Object> body) throws Exception {
        String content=mvc.perform(post("/api/assignments").header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isCreated()).andExpect(jsonPath("status").value("DRAFT")).andReturn().getResponse().getContentAsString();
        return json.readTree(content).get("id").asInt();
    }
    @Test void lifecycleAndArchivedFilter() throws Exception {
        int id=create(body());
        mvc.perform(post("/api/assignments/{id}/archive",id).header("Authorization",teacher)).andExpect(status().isConflict());
        mvc.perform(post("/api/assignments/{id}/publish",id).header("Authorization",teacher)).andExpect(status().isOk()).andExpect(jsonPath("status").value("PUBLISHED"));
        mvc.perform(delete("/api/assignments/{id}",id).header("Authorization",teacher)).andExpect(status().isConflict());
        mvc.perform(get("/api/assignments/{id}",id).header("Authorization",teacher)).andExpect(status().isOk());
        mvc.perform(post("/api/assignments/{id}/close",id).header("Authorization",teacher)).andExpect(status().isOk());
        mvc.perform(put("/api/assignments/{id}",id).header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body()))).andExpect(status().isConflict());
        mvc.perform(post("/api/assignments/{id}/archive",id).header("Authorization",teacher)).andExpect(status().isOk());
        mvc.perform(get("/api/assignments").header("Authorization",teacher)).andExpect(jsonPath("totalElements").value(0));
        mvc.perform(get("/api/assignments?status=ARCHIVED").header("Authorization",teacher)).andExpect(jsonPath("totalElements").value(1));
    }
    @Test void rolesOwnershipAndSubjectReassignment() throws Exception {
        int id=create(body());
        mvc.perform(get("/api/assignments")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/assignments").header("Authorization",student)).andExpect(status().isForbidden());
        mvc.perform(get("/api/subjects").header("Authorization",student)).andExpect(status().isForbidden());
        mvc.perform(get("/api/assignments/{id}",id).header("Authorization",other)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/assignments/{id}",id).header("Authorization",other)).andExpect(status().isForbidden());
        mvc.perform(get("/api/assignments").header("Authorization",other)).andExpect(jsonPath("totalElements").value(0));
        mvc.perform(get("/api/assignments/{id}",id).header("Authorization",admin)).andExpect(status().isOk());
        Map<String,Object> invalid=body(); invalid.put("subjectId",subjectId);
        mvc.perform(post("/api/assignments").header("Authorization",other).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid))).andExpect(status().isForbidden());
    }
    @Test void invalidRubricAndDatesDoNotSave() throws Exception {
        Map<String,Object> invalid=body(); invalid.put("rubric",List.of(Map.of("criteria","A","description","B","weight",90)));
        mvc.perform(post("/api/assignments").header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest()).andExpect(jsonPath("errors[0].field").value("rubric"));
        invalid=body(); invalid.put("dueDate",LocalDateTime.now().minusDays(1).toString());
        mvc.perform(post("/api/assignments").header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        assertThat(assignments.count()).isZero();
    }
    @Test void templateUsageOnlyIncrementsOnCreateAndAiFailureDoesNotSave() throws Exception {
        AssignmentTemplate t=new AssignmentTemplate(); t.setName("Mẫu API"); t.setSubjectId(subjectId); t.setDescription("Bài thực hành"); t.setDefaultMaxScore(BigDecimal.TEN); t.setCreatedBy(courses.findById(subjectId).orElseThrow().getTeacherId());
        t.setRubricJson(json.writeValueAsString(body().get("rubric"))); t=templates.save(t);
        Map<String,Object> request=body(); request.put("source","TEMPLATE"); request.put("templateId",t.getId()); int id=create(request);
        mvc.perform(put("/api/assignments/{id}",id).header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isOk());
        assertThat(templates.findById(t.getId()).orElseThrow().getUsageCount()).isEqualTo(1);
        mvc.perform(get("/api/assignment-templates/{id}",t.getId()).header("Authorization",other)).andExpect(status().isForbidden());
        mvc.perform(post("/api/assignments/ai/generate").header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("subjectId",subjectId,"topic","REST API","difficulty","Medium")))).andExpect(status().isServiceUnavailable());
        assertThat(assignments.count()).isEqualTo(1);
    }
    @Test void quizRoundTripAndAnswerValidation() throws Exception {
        Map<String,Object> request=body(); request.put("assignmentType","QUIZ");
        request.put("allowedFileTypes",List.of());
        request.put("questions",List.of(
            Map.of("text","Single question","type","SINGLE","options",List.of("A","B"),"correctAnswers",List.of(1)),
            Map.of("text","Multiple question","type","MULTIPLE","options",List.of("A","B","C"),"correctAnswers",List.of(0,2))));
        int id=create(request);
        mvc.perform(get("/api/assignments/{id}",id).header("Authorization",teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("assignmentType").value("QUIZ"))
            .andExpect(jsonPath("questions[0].correctAnswers[0]").value(1))
            .andExpect(jsonPath("questions[1].correctAnswers.length()").value(2));
        mvc.perform(post("/api/assignments/{id}/publish",id).header("Authorization",teacher)).andExpect(status().isOk());
        for(List<Integer> answers:List.of(List.<Integer>of(),List.of(0,1),List.of(2),List.of(-1))) {
            request.put("questions",List.of(Map.of("text","Invalid","type","SINGLE","options",List.of("A","B"),"correctAnswers",answers)));
            mvc.perform(put("/api/assignments/{id}",id).header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/assignments/{id}",id).header("Authorization",teacher)).andExpect(jsonPath("questions[0].text").value("Single question"));
        request.put("questions",List.of());
        mvc.perform(post("/api/assignments").header("Authorization",teacher).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
    }
    @Test void documentTypeSupportsWord() throws Exception {
        Map<String,Object> request=body(); request.put("assignmentType","DOCUMENT"); request.put("allowedFileTypes",List.of("DOC","DOCX","PDF"));
        int id=create(request);
        mvc.perform(get("/api/assignments/{id}",id).header("Authorization",teacher))
            .andExpect(status().isOk()).andExpect(jsonPath("assignmentType").value("DOCUMENT"))
            .andExpect(jsonPath("allowedFileTypes[0]").value("DOC")).andExpect(jsonPath("questions.length()").value(0));
    }
    @Test void studentsSeeOnlyPublishedAssignmentsOfActiveCoursesWithoutQuizAnswers() throws Exception {
        Map<String,Object> quiz=body(); quiz.put("assignmentType","QUIZ"); quiz.put("allowedFileTypes",List.of());
        quiz.put("questions",List.of(Map.of("text","Question","type","SINGLE","options",List.of("A","B"),"correctAnswers",List.of(1))));
        int id=create(quiz);
        mvc.perform(get("/api/student/assignments").header("Authorization",student)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/student/assignments/{id}",id).header("Authorization",student)).andExpect(status().isNotFound());
        mvc.perform(post("/api/assignments/{id}/publish",id).header("Authorization",teacher)).andExpect(status().isOk());
        mvc.perform(get("/api/student/assignments/{id}",id).header("Authorization",student)).andExpect(status().isForbidden());
        User learner=users.findByEmail("student@test.local").orElseThrow();
        Enrollment enrollment=new Enrollment(); enrollment.setStudent(learner);
        enrollment.setCourse(enrollmentCourses.findById(subjectId).orElseThrow()); enrollment.setStatus(EnrollmentStatus.ACTIVE);
        enrollments.save(enrollment);
        mvc.perform(get("/api/student/assignments").header("Authorization",student)).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].title").value("Bài tập REST API"))
            .andExpect(jsonPath("$[0].questions[0].correctAnswers").doesNotExist());
        mvc.perform(get("/api/student/assignments/{id}",id).header("Authorization",student)).andExpect(status().isOk())
            .andExpect(jsonPath("questions[0].correctAnswers").doesNotExist());
        mvc.perform(get("/api/student/assignments").header("Authorization",teacher)).andExpect(status().isForbidden());
    }

    @Test void studentCanSubmitMultipartAssignmentWithBearerToken() throws Exception {
        int id = create(body());
        mvc.perform(post("/api/assignments/{id}/publish", id).header("Authorization", teacher))
            .andExpect(status().isOk());
        User learner = users.findByEmail("student@test.local").orElseThrow();
        Enrollment enrollment = new Enrollment(); enrollment.setStudent(learner);
        enrollment.setCourse(enrollmentCourses.findById(subjectId).orElseThrow()); enrollment.setStatus(EnrollmentStatus.ACTIVE);
        enrollments.save(enrollment);

        mvc.perform(multipart("/api/student/assignments/{id}/submission", id)
                .file(new MockMultipartFile("file", "work.pdf", "application/pdf", "assignment work".getBytes()))
                .header("Authorization", student))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("status").value("SUBMITTED"));
    }
    @Test void deadlineClosesOnlyExpiredPublishedAssignments() throws Exception {
        int id=create(body()); mvc.perform(post("/api/assignments/{id}/publish",id).header("Authorization",teacher)).andExpect(status().isOk());
        Assignment a=assignments.findById(id).orElseThrow(); a.setDueDate(LocalDateTime.now().minusMinutes(1)); assignments.saveAndFlush(a);
        int draftId=create(body()); job.closeExpired();
        assertThat(assignments.findById(id).orElseThrow().getStatus()).isEqualTo(Assignment.Status.CLOSED);
        assertThat(assignments.findById(draftId).orElseThrow().getStatus()).isEqualTo(Assignment.Status.DRAFT);
    }
}
