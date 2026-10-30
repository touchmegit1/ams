package com.ams.auth;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.service.EmailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.config.import=",
        "spring.profiles.active=dev",
        "spring.datasource.url=jdbc:h2:mem:password_reset_test;DB_CLOSE_DELAY=-1;MODE=MySQL",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "app.frontend-url=http://localhost:5173",
        "google.client-id=",
        "spring.mail.username=",
        "spring.mail.password="
})
@AutoConfigureMockMvc
class PasswordResetIntegrationTest {
    private static final String EMAIL = "student@example.com";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @MockitoBean EmailService mail;
    @MockitoBean com.ams.auth.security.AuthRateLimiter limiter;

    @BeforeEach
    void setUp() {
        users.deleteAll();
        users.save(User.builder().fullName("Test Student").email(EMAIL)
                .passwordHash(encoder.encode("old-password"))
                .isVerified(true).otpCode("123456").otpExpiry(LocalDateTime.now().plusMinutes(5)).build());
    }

    @Test
    void resetsPasswordOnceAndAllowsLoginWithOnlyTheNewPassword() throws Exception {
        String token = requestToken();
        User before = account();
        assertThat(before.getPasswordResetTokenHash()).isEqualTo(hash(token)).doesNotContain(token);
        assertThat(before.getPasswordResetExpiry()).isAfter(LocalDateTime.now().plusMinutes(29));
        assertThat(encoder.matches("old-password", before.getPasswordHash())).isTrue();
        reset(token, "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isOk());
        User after = account();
        assertThat(encoder.matches("New-River!Garden2026", after.getPasswordHash())).isTrue();
        assertThat(after.getPasswordResetTokenHash()).isNull();
        assertThat(after.getPasswordResetExpiry()).isNull();
        assertThat(after.getOtpCode()).isNull();
        assertThat(after.getRole()).isEqualTo(User.Role.STUDENT);
        reset(token, "Another-River!Garden2026", "Another-River!Garden2026").andExpect(status().isBadRequest());
        postJson("/api/auth/login", Map.of("email", EMAIL, "password", "old-password"))
                .andExpect(status().isBadRequest());
        postJson("/api/auth/login", Map.of("email", EMAIL, "password", "New-River!Garden2026"))
                .andExpect(status().isOk()).andExpect(jsonPath("accessToken").isNotEmpty());
    }

    @Test
    void validatesTokenWithoutConsumingItAndRejectsItAfterUse() throws Exception {
        String token = requestToken();
        postJson("/api/auth/reset-password/validate", Map.of("token", token)).andExpect(status().isOk());
        assertThat(account().getPasswordResetTokenHash()).isEqualTo(hash(token));
        reset(token, "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isOk());
        postJson("/api/auth/reset-password/validate", Map.of("token", token)).andExpect(status().isBadRequest());
        postJson("/api/auth/reset-password/validate", Map.of("token", "A".repeat(43))).andExpect(status().isBadRequest());
    }

    @Test
    void expiresLinksWithoutChangingThePassword() throws Exception {
        String token = requestToken();
        User user = account();
        user.setPasswordResetExpiry(LocalDateTime.now().minusSeconds(1));
        users.save(user);
        postJson("/api/auth/reset-password/validate", Map.of("token", token)).andExpect(status().isBadRequest());
        reset(token, "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isBadRequest())
                .andExpect(jsonPath("message").value(org.hamcrest.Matchers.containsString("hết hạn")));
        assertThat(encoder.matches("old-password", account().getPasswordHash())).isTrue();
    }

    @Test
    void rejectsUnknownTokensAndRegistrationOtp() throws Exception {
        requestToken();
        reset("A".repeat(43), "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isBadRequest());
        reset("123456", "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isBadRequest());
        assertThat(encoder.matches("old-password", account().getPasswordHash())).isTrue();
    }

    @Test
    void validatesEmailWithoutSendingMail() throws Exception {
        postJson("/api/auth/forgot-password", Map.of("email", "bad-email"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("email").exists());
        postJson("/api/auth/forgot-password", Map.of("email", ""))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(mail);
    }

    @Test
    void usesSameResponseForUnknownGoogleOnlyAndUnverifiedAccounts() throws Exception {
        String knownResponse = postJson("/api/auth/forgot-password", Map.of("email", EMAIL))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        clearInvocations(mail);
        postJson("/api/auth/forgot-password", Map.of("email", "missing@example.com"))
                .andExpect(status().isOk()).andExpect(content().string(knownResponse));
        User user = account();
        user.setPasswordHash(null);
        user.setPasswordResetRequestedAt(null);
        users.save(user);
        postJson("/api/auth/forgot-password", Map.of("email", EMAIL))
                .andExpect(status().isOk()).andExpect(content().string(knownResponse));
        user.setPasswordHash(encoder.encode("old-password"));
        user.setIsVerified(false);
        users.save(user);
        postJson("/api/auth/forgot-password", Map.of("email", EMAIL))
                .andExpect(status().isOk()).andExpect(content().string(knownResponse));
        verifyNoInteractions(mail);
    }

    @Test
    void throttlesResendsAndReplacesOldLinkAfterCooldown() throws Exception {
        String first = requestToken();
        clearInvocations(mail);
        postJson("/api/auth/forgot-password", Map.of("email", EMAIL)).andExpect(status().isOk());
        verifyNoInteractions(mail);
        assertThat(account().getPasswordResetTokenHash()).isEqualTo(hash(first));
        User user = account();
        user.setPasswordResetRequestedAt(LocalDateTime.now().minusSeconds(61));
        users.save(user);
        String second = requestToken();
        assertThat(second).isNotEqualTo(first);
        reset(first, "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isBadRequest());
        reset(second, "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isOk());
    }

    @Test
    void rejectsMismatchedShortLongAndBlankPasswordsWithoutConsumingLink() throws Exception {
        String token = requestToken();
        reset(token, "New-River!Garden2026", "mismatch").andExpect(status().isBadRequest())
                .andExpect(jsonPath("passwordsMatch").exists());
        for (String invalid : new String[]{"short", "a".repeat(65), "      "}) {
            reset(token, invalid, invalid).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("password").exists());
        }
        assertThat(account().getPasswordResetTokenHash()).isEqualTo(hash(token));
        reset(token, "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isOk());
    }

    @Test
    void rollsBackFailedMailSoUserCanRetryImmediately() throws Exception {
        doThrow(new com.ams.auth.exception.AuthBusinessException("Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau."))
                .when(mail).sendPasswordResetEmail(eq(EMAIL), anyString());
        postJson("/api/auth/forgot-password", Map.of("email", EMAIL)).andExpect(status().isBadRequest());
        assertThat(account().getPasswordResetTokenHash()).isNull();
        assertThat(account().getPasswordResetRequestedAt()).isNull();
        doNothing().when(mail).sendPasswordResetEmail(eq(EMAIL), anyString());
        clearInvocations(mail);
        requestToken();
    }

    @Test
    void failedResendPreservesPreviouslyDeliveredLink() throws Exception {
        String token = requestToken();
        User user = account();
        user.setPasswordResetRequestedAt(LocalDateTime.now().minusSeconds(61));
        users.save(user);
        doThrow(new com.ams.auth.exception.AuthBusinessException("Mail unavailable"))
                .when(mail).sendPasswordResetEmail(eq(EMAIL), anyString());
        postJson("/api/auth/forgot-password", Map.of("email", EMAIL)).andExpect(status().isBadRequest());
        reset(token, "New-River!Garden2026", "New-River!Garden2026").andExpect(status().isOk());
    }

    private String requestToken() throws Exception {
        postJson("/api/auth/forgot-password", Map.of("email", EMAIL)).andExpect(status().isOk());
        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordResetEmail(eq(EMAIL), url.capture());
        assertThat(url.getValue()).startsWith("http://localhost:5173/reset-password#token=");
        String token = url.getValue().split("#token=")[1];
        assertThat(token).matches("[A-Za-z0-9_-]{43}");
        return token;
    }

    private ResultActions reset(String token, String password, String confirmation) throws Exception {
        return postJson("/api/auth/reset-password", Map.of("token", token,
                "password", password, "confirmPassword", confirmation));
    }

    private ResultActions postJson(String path, Object body) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(body)));
    }

    private User account() { return users.findByEmail(EMAIL).orElseThrow(); }

    private String hash(String token) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8)));
    }
}
