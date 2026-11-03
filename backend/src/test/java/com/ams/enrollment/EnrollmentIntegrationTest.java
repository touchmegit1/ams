package com.ams.enrollment;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.JwtTokenProvider;
import com.ams.coursemgmt.entity.*;
import com.ams.coursemgmt.repository.*;
import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.Payment;
import com.ams.enrollment.entity.PaymentStatus;
import com.ams.enrollment.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.config.import=", "spring.profiles.active=dev", "spring.datasource.url=jdbc:h2:mem:enrollment_tests;DB_CLOSE_DELAY=-1;MODE=MySQL", "spring.jpa.hibernate.ddl-auto=create-drop", "sepay.bank=VCB", "sepay.account-number=123456789", "sepay.order-prefix=AMS", "sepay.webhook-secret=test-secret"})
@AutoConfigureMockMvc
class EnrollmentIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired CourseRepository courses;
    @Autowired CourseModuleRepository modules;
    @Autowired LessonRepository lessons;
    @Autowired EnrollmentRepository enrollments;
    @Autowired PaymentRepository payments;
    @Autowired PaymentReviewRepository reviews;
    @Autowired SepayTransactionRepository transactions;
    @Autowired JwtTokenProvider jwt;
    String student;
    Integer courseId;

    @BeforeEach void setup() {
        reviews.deleteAll(); transactions.deleteAll(); payments.deleteAll(); enrollments.deleteAll(); lessons.deleteAll(); modules.deleteAll(); courses.deleteAll(); users.deleteAll();
        User teacher = account("teacher", User.Role.TEACHER);
        User learner = account("learner", User.Role.STUDENT);
        student = "Bearer " + jwt.generateToken(learner.getUserId(), learner.getEmail(), learner.getRole().name(), learner.getAuthVersion());
        Course course = new Course(); course.setTeacher(teacher); course.setCourseCode("TEST100"); course.setTitle("Test course");
        course.setSubject("Testing"); course.setPrice(new BigDecimal("100000")); course.setStatus(CourseStatus.PUBLISHED);
        courseId = courses.save(course).getCourseId();
    }
    User account(String name, User.Role role) {
        return users.save(User.builder().fullName(name).email(name + "@example.test").role(role).isVerified(true).build());
    }
    String enroll() throws Exception {
        return mvc.perform(post("/api/enrollments/courses/{id}", courseId).header("Authorization", student))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }
    String pendingOrder() throws Exception {
        User learner = users.findByEmail("learner@example.test").orElseThrow();
        Enrollment enrollment = enrollments.findByStudent_UserIdAndCourse_CourseId(learner.getUserId(), courseId).orElse(null);
        if (enrollment == null) {
            enrollment = new Enrollment(); enrollment.setStudent(learner); enrollment.setCourse(courses.findById(courseId).orElseThrow());
            enrollment = enrollments.saveAndFlush(enrollment);
        }
        Payment payment = payments.findTopByEnrollment_IdOrderByCreatedAtDescIdDesc(enrollment.getId()).orElse(null);
        if (payment == null) {
            payment = new Payment(); payment.setEnrollment(enrollment); payment.setOrderCode("AMS" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase());
            payment.setAmount(new BigDecimal("100000")); payment.setAccountNumber("123456789");
            payment.setExpiresAt(Instant.now().plus(Duration.ofHours(1))); payment = payments.saveAndFlush(payment);
        }
        return payment.getOrderCode();
    }
    void webhook(long id, String code, long amount, String account, boolean valid) throws Exception {
        webhookWithContent(id, code, "", amount, account, valid);
    }
    void webhookWithContent(long id, String code, String content, long amount, String account, boolean valid) throws Exception {
        byte[] body = json.writeValueAsBytes(Map.of("id", id, "code", code, "content", content, "accountNumber", account,
                "transferType", "in", "transferAmount", amount, "transactionDate",
                LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusSeconds(1).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))));
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("test-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
        String signature = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
        mvc.perform(post("/api/webhooks/sepay").contentType(MediaType.APPLICATION_JSON).content(body)
                .header("X-SePay-Timestamp", timestamp).header("X-SePay-Signature", valid ? signature : "sha256=bad"))
                .andExpect(valid ? status().isOk() : status().isUnauthorized());
    }
    @Test void paidEnrollmentRequiresMatchingWebhookAndIgnoresReplay() throws Exception {
        String code = pendingOrder();
        assertThat(pendingOrder()).isEqualTo(code);
        webhook(101, code, 100000, "123456789", false);
        assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("PENDING");
        webhook(101, code, 100000, "123456789", true);
        webhook(101, code, 100000, "123456789", true);
        assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("ACTIVE");
        assertThat(transactions.count()).isEqualTo(1);
    }
    @Test void paidCourseEnrollmentActivatesImmediatelyWithoutCreatingPayment() throws Exception {
        mvc.perform(post("/api/enrollments/courses/{id}", courseId).header("Authorization", student))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("ACTIVE"))
                .andExpect(jsonPath("paymentId").doesNotExist()).andExpect(jsonPath("qrUrl").doesNotExist());
        assertThat(enrollments.findAll()).hasSize(1);
        assertThat(payments.findAll()).isEmpty();
        assertThat(enrollments.findAll().get(0).getActivatedAt()).isNotNull();
    }
    @Test void enrollingAgainActivatesLegacyPendingEnrollmentAndExpiresItsQr() throws Exception {
        User learner = users.findByEmail("learner@example.test").orElseThrow();
        Enrollment enrollment = new Enrollment(); enrollment.setStudent(learner);
        enrollment.setCourse(courses.findById(courseId).orElseThrow());
        enrollment = enrollments.saveAndFlush(enrollment);
        Payment payment = new Payment(); payment.setEnrollment(enrollment); payment.setOrderCode("OLD-ORDER-1");
        payment.setAmount(new BigDecimal("100000")); payment.setAccountNumber("123456789");
        payment.setExpiresAt(Instant.now().plus(Duration.ofHours(1))); payments.saveAndFlush(payment);

        mvc.perform(post("/api/enrollments/courses/{id}", courseId).header("Authorization", student))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("ACTIVE"))
                .andExpect(jsonPath("paymentStatus").value("EXPIRED"));
        assertThat(enrollments.findById(enrollment.getId()).orElseThrow().getStatus().name()).isEqualTo("ACTIVE");
        assertThat(payments.findById(payment.getId()).orElseThrow().getStatus().name()).isEqualTo("EXPIRED");
    }
    @Test void lateWebhookCannotCollectAfterPendingQrWasCanceledForDirectAccess() throws Exception {
        User learner = users.findByEmail("learner@example.test").orElseThrow();
        Enrollment enrollment = new Enrollment(); enrollment.setStudent(learner);
        enrollment.setCourse(courses.findById(courseId).orElseThrow()); enrollment = enrollments.saveAndFlush(enrollment);
        Payment payment = new Payment(); payment.setEnrollment(enrollment); payment.setOrderCode("OLD-ORDER-2");
        payment.setAmount(new BigDecimal("100000")); payment.setAccountNumber("123456789");
        payment.setExpiresAt(Instant.now().plus(Duration.ofHours(1))); payments.saveAndFlush(payment);
        mvc.perform(post("/api/enrollments/courses/{id}", courseId).header("Authorization", student)).andExpect(status().isOk());

        webhook(919, "OLD-ORDER-2", 100000, "123456789", true);
        assertThat(enrollments.findById(enrollment.getId()).orElseThrow().getStatus().name()).isEqualTo("ACTIVE");
        assertThat(payments.findById(payment.getId()).orElseThrow().getStatus().name()).isEqualTo("EXPIRED");
        assertThat(reviews.findAll()).anySatisfy(review -> assertThat(review.getReason()).isEqualTo("ORDER_NOT_PENDING"));
    }
    @Test void wrongAmountGoesToReviewAndFreeCourseActivatesImmediately() throws Exception {
        String code = pendingOrder();
        webhook(202, code, 90000, "123456789", true);
        assertThat(reviews.count()).isEqualTo(1);
        assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("PENDING");
        Course course = courses.findById(courseId).orElseThrow(); course.setPrice(BigDecimal.ZERO); courses.save(course);
        Integer freeId = courses.save(newCourse("FREE100", course.getTeacher())).getCourseId();
        mvc.perform(post("/api/enrollments/courses/{id}", freeId).header("Authorization", student))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("ACTIVE"));
    }
    @Test void replayOfReviewedWebhookUsesExactCodeInContent() throws Exception {
        String code = pendingOrder();
        webhookWithContent(707, "", "Unrecognized payment", 100000, "123456789", true);
        assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("PENDING");
        webhookWithContent(707, "", "Chuyen tien " + code + " khoa hoc", 100000, "123456789", true);
        assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("ACTIVE");
        assertThat(reviews.findAll().get(0).getStatus().name()).isEqualTo("CLOSED");
        assertThat(transactions.count()).isEqualTo(1);
    }
    @Test void codeInContentDoesNotOverrideWrongAccount() throws Exception {
        String code = pendingOrder();
        webhookWithContent(808, "", code, 100000, "999999999", true);
        assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("PENDING");
        assertThat(reviews.findAll().get(0).getReason()).isEqualTo("WRONG_ACCOUNT");
    }
    @Test void paymentToCurrentReceivingAccountCanMatchOlderQrAccount() throws Exception {
        String code = pendingOrder();
        var payment = payments.findByOrderCode(code).orElseThrow();
        payment.setAccountNumber("previous-account");
        payments.save(payment);
        webhookWithContent(909, "", "Chuyen khoan " + code, 100000, "123456789", true);
        assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("ACTIVE");
    }
    @Test void previewHidesLessonContentUntilActive() throws Exception {
        mvc.perform(get("/api/courses/published").header("Authorization", student))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].teacherName").value("teacher"));
        CourseModule module = new CourseModule(); module.setCourse(courses.findById(courseId).orElseThrow());
        module.setTitle("Module"); module = modules.save(module);
        Lesson lesson = new Lesson(); lesson.setModule(module); lesson.setTitle("Lesson");
        lesson.setContent("Paid content"); lessons.save(lesson);
        mvc.perform(get("/api/courses/published/{id}/modules", courseId).header("Authorization", student))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].lessons[0].content").isEmpty());
        mvc.perform(post("/api/enrollments/courses/{id}", courseId).header("Authorization", student))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("ACTIVE"));
        assertThat(payments.findAll()).isEmpty();
        mvc.perform(get("/api/courses/published/{id}/modules", courseId).header("Authorization", student))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].lessons[0].content").value("Paid content"));
    }
    @Test void archivedCourseKeepsPaidAccessAndCannotBeDeleted() throws Exception {
        User teacher = users.findById(courses.findById(courseId).orElseThrow().getTeacher().getUserId()).orElseThrow();
        String teacherToken = "Bearer " + jwt.generateToken(teacher.getUserId(), teacher.getEmail(), teacher.getRole().name(), teacher.getAuthVersion());
        String code = pendingOrder();
        webhook(505, code, 100000, "123456789", true);
        Course course = courses.findById(courseId).orElseThrow(); course.setStatus(CourseStatus.ARCHIVED); courses.save(course);
        mvc.perform(get("/api/courses/published/{id}/modules", courseId).header("Authorization", student))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/courses/{id}", courseId).header("Authorization", teacherToken))
                .andExpect(status().isConflict());
    }
    @Test void simultaneousWebhookDeliveryActivatesOnce() throws Exception {
        String code = pendingOrder();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<?> first = pool.submit(() -> { try { start.await(); webhook(606, code, 100000, "123456789", true); } catch (Exception e) { throw new RuntimeException(e); } });
            Future<?> second = pool.submit(() -> { try { start.await(); webhook(606, code, 100000, "123456789", true); } catch (Exception e) { throw new RuntimeException(e); } });
            start.countDown(); first.get(15, TimeUnit.SECONDS); second.get(15, TimeUnit.SECONDS);
            assertThat(transactions.count()).isEqualTo(1);
            assertThat(enrollments.findAll().get(0).getStatus().name()).isEqualTo("ACTIVE");
        } finally { pool.shutdownNow(); }
    }
    Course newCourse(String code, User teacher) {
        Course course = new Course(); course.setTeacher(teacher); course.setCourseCode(code); course.setTitle(code);
        course.setSubject("Testing"); course.setPrice(BigDecimal.ZERO); course.setStatus(CourseStatus.PUBLISHED); return course;
    }
}
