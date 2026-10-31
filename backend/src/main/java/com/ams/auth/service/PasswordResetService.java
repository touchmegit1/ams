package com.ams.auth.service;

import com.ams.auth.dto.request.ResetPasswordRequest;
import com.ams.auth.dto.response.MessageResponse;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.exception.AuthBusinessException;
import com.ams.auth.security.AuthRateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.Locale;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class PasswordResetService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String REQUEST_MESSAGE = "Nếu email thuộc tài khoản đã xác thực có mật khẩu, "
            + "bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư và thư rác.";
    private static final String INVALID_LINK = "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final String frontendUrl;
    private final AuthRateLimiter limiter;

    public PasswordResetService(UserRepository userRepository, PasswordEncoder passwordEncoder,
            EmailService emailService, AuthRateLimiter limiter,
            @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.limiter = limiter;
        URI uri = URI.create(frontendUrl);
        if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalArgumentException("FRONTEND_URL phải là địa chỉ HTTP/HTTPS của frontend");
        }
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    @Transactional
    public MessageResponse requestReset(String email) {
        limiter.check("reset-mail:" + email.trim().toLowerCase(Locale.ROOT), 3, Duration.ofMinutes(15));
        User user = userRepository.findByEmailForPasswordReset(email.trim()).orElse(null);
        LocalDateTime now = LocalDateTime.now();
        // Same public response for unknown, Google-only, unverified and throttled accounts.
        if (!canReset(user) || (user.getPasswordResetRequestedAt() != null
                && now.isBefore(user.getPasswordResetRequestedAt().plusSeconds(60)))) {
            return new MessageResponse(REQUEST_MESSAGE);
        }

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        user.setPasswordResetTokenHash(hash(token));
        user.setPasswordResetExpiry(now.plusMinutes(30));
        user.setPasswordResetRequestedAt(now);
        userRepository.save(user);
        // The fragment keeps the secret out of page requests and Referer headers.
        // An email failure rolls back the token and the resend cooldown.
        emailService.sendPasswordResetEmail(user.getEmail(), frontendUrl + "/reset-password#token=" + token);
        return new MessageResponse(REQUEST_MESSAGE);
    }

    @Transactional
    public MessageResponse validateToken(String token) {
        User user = userRepository.findByPasswordResetTokenHash(hash(token))
                .orElseThrow(() -> new AuthBusinessException(INVALID_LINK));
        if (!canReset(user) || user.getPasswordResetExpiry() == null
                || !LocalDateTime.now().isBefore(user.getPasswordResetExpiry())) {
            throw new AuthBusinessException(INVALID_LINK);
        }
        return new MessageResponse("Liên kết hợp lệ.");
    }

    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByPasswordResetTokenHash(hash(request.getToken()))
                .orElseThrow(() -> new AuthBusinessException(INVALID_LINK));
        if (!canReset(user) || user.getPasswordResetExpiry() == null
                || !LocalDateTime.now().isBefore(user.getPasswordResetExpiry())) {
            throw new AuthBusinessException(INVALID_LINK);
        }
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setAuthVersion(user.getAuthVersion() + 1);
        user.setOtpCode(null);
        user.setOtpHash(null);
        user.setOtpExpiry(null);
        user.setPasswordResetTokenHash(null);
        user.setPasswordResetExpiry(null);
        userRepository.save(user);
        return new MessageResponse("Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.");
    }

    private boolean canReset(User user) {
        return user != null && Boolean.TRUE.equals(user.getIsVerified()) && user.getPasswordHash() != null;
    }

    private String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
