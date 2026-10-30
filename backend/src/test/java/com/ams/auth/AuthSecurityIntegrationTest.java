package com.ams.auth;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.AuthRateLimiter;
import com.ams.auth.security.GoogleTokenVerifier;
import com.ams.auth.security.JwtTokenProvider;
import com.ams.auth.service.EmailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import java.time.LocalDateTime;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.config.import=", "spring.profiles.active=dev",
        "spring.datasource.url=jdbc:h2:mem:auth_security_test;DB_CLOSE_DELAY=-1;MODE=MySQL",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false",
        "app.frontend-url=http://localhost:5173", "google.client-id=",
        "spring.mail.username=", "spring.mail.password="
})
@AutoConfigureMockMvc
class AuthSecurityIntegrationTest {
    private static final String EMAIL = "security@example.com";
    private static final String PASSWORD = "Ab1!xyzw";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtTokenProvider jwt;
    @MockitoBean EmailService mail;
    @MockitoBean AuthRateLimiter limiter;
    @MockitoBean GoogleTokenVerifier google;

    @BeforeEach void setup() { users.deleteAll(); }

    @Test void rejectsWeakPasswordsOnRegistrationAndResetEvenWithoutFrontend() throws Exception {
        for (String weak : new String[]{"Ab1!xy", "Ab1!xyz", "123456", "123456789012345", "LongLowercaseOnly", "LongEnoughWith1Number", "PASSWORD1234567!", "Password1234567!"}) {
            postJson("/register", registration(weak, "STUDENT")).andExpect(status().isBadRequest()).andExpect(jsonPath("password").exists());
            postJson("/reset-password", Map.of("token", "A".repeat(43), "password", weak, "confirmPassword", weak))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("password").exists());
        }
        assertThat(users.count()).isZero();
        verifyNoInteractions(mail);
    }

    @Test void publicRegistrationCannotGrantTeacherOrAdminAndOtpIsHashed() throws Exception {
        for (String role : new String[]{"TEACHER", "ADMIN"}) {
            postJson("/register", registration(PASSWORD, role)).andExpect(status().isBadRequest()).andExpect(jsonPath("role").exists());
        }
        postJson("/register", registration(PASSWORD, "STUDENT")).andExpect(status().isCreated());
        ArgumentCaptor<String> otp = ArgumentCaptor.forClass(String.class);
        verify(mail).sendOtpEmail(eq(EMAIL), otp.capture());
        User user = account();
        assertThat(user.getRole()).isEqualTo(User.Role.STUDENT);
        assertThat(user.getOtpCode()).isNull();
        assertThat(user.getOtpHash()).isNotEqualTo(otp.getValue());
        assertThat(encoder.matches(otp.getValue(), user.getOtpHash())).isTrue();
        assertThat(encoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
    }

    @Test void fiveWrongOtpAttemptsArePersistedAndBlockTheCorrectCode() throws Exception {
        seed(false);
        User user = account();
        user.setOtpHash(encoder.encode("123456")); user.setOtpExpiry(LocalDateTime.now().plusMinutes(5)); users.save(user);
        for (int i = 0; i < 5; i++) {
            postJson("/verify-otp", Map.of("email", EMAIL, "otpCode", "654321")).andExpect(status().isBadRequest());
            assertThat(account().getOtpAttempts()).isEqualTo(i + 1);
        }
        postJson("/verify-otp", Map.of("email", EMAIL, "otpCode", "123456")).andExpect(status().isBadRequest());
        assertThat(account().getIsVerified()).isFalse();
        assertThat(account().getOtpHash()).isNull();
    }

    @Test void otpSuccessCannotBeReplayedAndExpiredOtpCannotVerify() throws Exception {
        seed(false);
        User user = account(); user.setOtpHash(encoder.encode("123456")); user.setOtpExpiry(LocalDateTime.now().minusSeconds(1)); users.save(user);
        postJson("/verify-otp", Map.of("email", EMAIL, "otpCode", "123456")).andExpect(status().isBadRequest());
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(5)); users.save(user);
        postJson("/verify-otp", Map.of("email", EMAIL, "otpCode", "123456")).andExpect(status().isOk());
        postJson("/verify-otp", Map.of("email", EMAIL, "otpCode", "123456")).andExpect(status().isBadRequest());
        assertThat(account().getOtpHash()).isNull();
    }

    @Test void resendHasServerCooldownAndUnknownEmailUsesSameMessage() throws Exception {
        seed(false);
        String response = postJson("/resend-otp", Map.of("email", EMAIL)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        postJson("/resend-otp", Map.of("email", EMAIL)).andExpect(status().isOk()).andExpect(content().string(response));
        postJson("/resend-otp", Map.of("email", "missing@example.com")).andExpect(status().isOk()).andExpect(content().string(response));
        verify(mail, times(1)).sendOtpEmail(eq(EMAIL), anyString());
    }

    @Test void resetRevokesExistingAccessTokenAndNewLoginWorks() throws Exception {
        seed(true);
        String oldToken = loginToken(PASSWORD);
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + oldToken)).andExpect(status().isOk());
        postJson("/forgot-password", Map.of("email", EMAIL)).andExpect(status().isOk());
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordResetEmail(eq(EMAIL), link.capture());
        String resetToken = link.getValue().split("#token=")[1];
        String changed = "Zy2!wvut";
        postJson("/reset-password", Map.of("token", resetToken, "password", changed, "confirmPassword", changed)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + oldToken)).andExpect(status().isUnauthorized());
        String newToken = loginToken(changed);
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + newToken)).andExpect(status().isOk());
    }

    @Test void logoutRevokesTokensAndRemovedOrUnverifiedUsersCannotUseTokens() throws Exception {
        seed(true);
        String token = loginToken(PASSWORD);
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        token = loginToken(PASSWORD);
        User user = account(); user.setIsVerified(false); users.save(user);
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        users.deleteAll();
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void malformedTokenIsUnauthorizedAndDiagnosticEndpointsAreNotPublic() throws Exception {
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer not-a-jwt")).andExpect(status().isUnauthorized());
        for (String path : new String[]{"/h2-console/", "/actuator/env", "/v3/api-docs"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
    }

    @Test void preservesLegacyBcryptLoginAndUpgradesHashWithoutTruncatingUnicode() throws Exception {
        User user = seed(true); user.setPasswordHash(new BCryptPasswordEncoder().encode(PASSWORD)); users.save(user);
        loginToken(PASSWORD);
        assertThat(account().getPasswordHash()).startsWith("{pbkdf2}");
        String unicode = "Áa1!" + "ệ".repeat(60);
        String hash = encoder.encode(unicode);
        assertThat(encoder.matches(unicode, hash)).isTrue();
        assertThat(encoder.matches(unicode.substring(0, unicode.length() - 1) + "x", hash)).isFalse();
    }

    @Test void googleRequiresVerifiedEmailAndDoesNotLinkNonAuthoritativeEmail() throws Exception {
        seed(true);
        var payload = googlePayload(EMAIL, false);
        when(google.verify(anyString())).thenReturn(payload);
        postJson("/google-login", Map.of("idToken", "test-token")).andExpect(status().isBadRequest());
        payload.setEmailVerified(true);
        postJson("/google-login", Map.of("idToken", "test-token")).andExpect(status().isBadRequest());
        assertThat(account().getGoogleId()).isNull();
    }

    @Test void googleLinkingClearsUnverifiedPasswordAndRegistrationOtp() throws Exception {
        User user = seed(false); user.setEmail("security@gmail.com");
        user.setOtpHash(encoder.encode("123456")); user.setOtpExpiry(LocalDateTime.now().plusMinutes(5)); users.save(user);
        when(google.verify(anyString())).thenReturn(googlePayload(user.getEmail(), true));
        postJson("/google-login", Map.of("idToken", "test-token")).andExpect(status().isOk());
        User linked = users.findByEmail(user.getEmail()).orElseThrow();
        assertThat(linked.getPasswordHash()).isNull();
        assertThat(linked.getOtpHash()).isNull();
        assertThat(linked.getIsVerified()).isTrue();
        postJson("/verify-otp", Map.of("email", user.getEmail(), "otpCode", "123456")).andExpect(status().isBadRequest());
    }

    @Test void unexpectedFailureDoesNotExposeInternalDetails() throws Exception {
        when(google.verify(anyString())).thenThrow(new IllegalStateException("secret=DO_NOT_EXPOSE; database internal details"));
        postJson("/google-login", Map.of("idToken", "test-token")).andExpect(status().isInternalServerError())
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("DO_NOT_EXPOSE"))));
    }

    @Test void rejectsOversizedAndMalformedJsonWithoutEchoingInput() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"" + "x".repeat(10000) + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("message").exists());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{invalid"))
                .andExpect(status().isBadRequest());
    }

    @Test void startupCleanupRemovesLegacyPlaintextOtp() {
        User user = seed(false); user.setOtpCode("123456"); users.save(user);
        users.removeLegacyPlaintextOtps();
        assertThat(account().getOtpCode()).isNull();
    }

    private User seed(boolean verified) {
        return users.save(User.builder().fullName("Security Test").email(EMAIL).passwordHash(encoder.encode(PASSWORD)).isVerified(verified).build());
    }
    private User account() { return users.findByEmail(EMAIL).orElseThrow(); }
    private Map<String, String> registration(String password, String role) {
        return Map.of("fullName", "Security Test", "email", EMAIL, "password", password, "role", role);
    }
    private GoogleIdToken.Payload googlePayload(String email, boolean verified) {
        var payload = new GoogleIdToken.Payload(); payload.setSubject("google-test-subject"); payload.setEmail(email); payload.setEmailVerified(verified); return payload;
    }
    private String loginToken(String password) throws Exception {
        String body = postJson("/login", Map.of("email", EMAIL, "password", password)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("accessToken").asText();
    }
    private ResultActions postJson(String path, Object body) throws Exception {
        return mvc.perform(post("/api/auth" + path).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(body)));
    }
}
