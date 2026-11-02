package com.ams.enrollment;

import com.ams.assignment.entity.Assignment;
import com.ams.assignment.entity.Submission;
import com.ams.assignment.repository.AssignmentRepository;
import com.ams.assignment.repository.SubmissionRepository;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.JwtTokenProvider;
import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseModule;
import com.ams.coursemgmt.entity.CourseStatus;
import com.ams.coursemgmt.entity.Lesson;
import com.ams.coursemgmt.entity.LessonProgress;
import com.ams.coursemgmt.repository.CourseModuleRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.coursemgmt.repository.LessonProgressRepository;
import com.ams.coursemgmt.repository.LessonRepository;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.config.import=", "spring.profiles.active=dev", "spring.datasource.url=jdbc:h2:mem:course_progress_tests;DB_CLOSE_DELAY=-1;MODE=MySQL", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.task.scheduling.enabled=false", "gemini.api-key="})
@AutoConfigureMockMvc
class CourseLearningProgressIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired CourseRepository courses;
    @Autowired CourseModuleRepository modules;
    @Autowired LessonRepository lessons;
    @Autowired LessonProgressRepository progress;
    @Autowired EnrollmentRepository enrollments;
    @Autowired AssignmentRepository assignments;
    @Autowired SubmissionRepository submissions;
    @Autowired JwtTokenProvider jwt;
    String teacherToken, studentToken, pendingToken;
    Integer courseId, lessonId, studentId;

    @BeforeEach void setup() {
        submissions.deleteAll(); assignments.deleteAll(); progress.deleteAll(); enrollments.deleteAll(); lessons.deleteAll(); modules.deleteAll(); courses.deleteAll(); users.deleteAll();
        User teacher = account("teacher", User.Role.TEACHER); User learner = account("learner", User.Role.STUDENT); User pending = account("pending", User.Role.STUDENT);
        studentId = learner.getUserId(); teacherToken = token(teacher); studentToken = token(learner); pendingToken = token(pending);
        Course course = new Course(); course.setTeacher(teacher); course.setCourseCode("PROGRESS"); course.setTitle("Progress course"); course.setPrice(BigDecimal.ZERO); course.setStatus(CourseStatus.PUBLISHED);
        courseId = courses.save(course).getCourseId();
        CourseModule module = new CourseModule(); module.setCourse(course); module.setTitle("Module"); module = modules.save(module);
        Lesson lesson = new Lesson(); lesson.setModule(module); lesson.setTitle("Lesson"); lessonId = lessons.save(lesson).getLessonId();
        enroll(learner, course, EnrollmentStatus.ACTIVE); enroll(pending, course, EnrollmentStatus.PENDING);
    }
    User account(String name, User.Role role) { return users.save(User.builder().fullName(name).email(name+"@progress.test").role(role).isVerified(true).build()); }
    String token(User user) { return "Bearer " + jwt.generateToken(user.getUserId(), user.getEmail(), user.getRole().name(), user.getAuthVersion()); }
    void enroll(User user, Course course, EnrollmentStatus status) { Enrollment row = new Enrollment(); row.setStudent(user); row.setCourse(course); row.setStatus(status); row.setCreatedAt(Instant.now()); enrollments.save(row); }

    @Test void activeStudentCanMarkLessonCompleteIdempotentlyAndProgressIsReported() throws Exception {
        mvc.perform(post("/api/student/lessons/{id}/complete", lessonId).header("Authorization", studentToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true));
        mvc.perform(post("/api/student/lessons/{id}/complete", lessonId).header("Authorization", studentToken)).andExpect(status().isOk());
        assertThat(progress.count()).isEqualTo(1);
        mvc.perform(get("/api/student/courses/{id}/progress", courseId).header("Authorization", studentToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.completedLessons").value(1)).andExpect(jsonPath("$.lessonProgressPercent").value(100.0));
    }

    @Test void pendingStudentCannotMarkLessonComplete() throws Exception {
        mvc.perform(post("/api/student/lessons/{id}/complete", lessonId).header("Authorization", pendingToken))
            .andExpect(status().isForbidden());
        assertThat(progress.count()).isZero();
    }

    @Test void teacherRosterShowsAssignmentCompletionAndOfficialGradeAndExportsCsv() throws Exception {
        Assignment assignment = new Assignment(); assignment.setSubjectId(courseId); assignment.setTitle("Assignment"); assignment.setDescription("Do work");
        assignment.setRubricJson("[]"); assignment.setMaxScore(new BigDecimal("10")); assignment.setDueDate(LocalDateTime.now().plusDays(1));
        assignment.setStatus(Assignment.Status.PUBLISHED); assignments.saveAndFlush(assignment);
        Submission submission = new Submission(); submission.setAssignment(assignment); submission.setStudent(users.findById(studentId).orElseThrow());
        submission.setStatus(Submission.Status.TEACHER_REVIEWED); submission.setTeacherScore(new BigDecimal("8")); submission.setAttemptNumber(1); submissions.saveAndFlush(submission);
        mvc.perform(get("/api/courses/{id}/students", courseId).header("Authorization", teacherToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.studentId == " + studentId + ")].completedAssignments").value(org.hamcrest.Matchers.hasItem(1)))
            .andExpect(jsonPath("$[?(@.studentId == " + studentId + ")].averageScorePercent").value(org.hamcrest.Matchers.hasItem(80.0)));
        mvc.perform(get("/api/courses/{id}/analytics", courseId).header("Authorization", teacherToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.activeStudents").value(1)).andExpect(jsonPath("$.pendingEnrollments").value(1));
        mvc.perform(get("/api/courses/{id}/students/export.csv", courseId).header("Authorization", teacherToken))
            .andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("learner@progress.test")));
    }

    @Test void studentCannotReadTeacherAnalytics() throws Exception {
        mvc.perform(get("/api/courses/{id}/analytics", courseId).header("Authorization", studentToken)).andExpect(status().isForbidden());
    }
}
