package com.ams.auth.service.impl;

import com.ams.auth.dto.request.*;
import com.ams.auth.dto.response.AuthResponse;
import com.ams.auth.dto.response.MessageResponse;
import com.ams.auth.entity.User;
import com.ams.auth.exception.AuthBusinessException;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.AuthRateLimiter;
import com.ams.auth.security.GoogleTokenVerifier;
import com.ams.auth.security.JwtTokenProvider;
import com.ams.auth.service.AuthService;
import com.ams.auth.service.EmailService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String REGISTRATION_MESSAGE = "Nếu email có thể đăng ký, mã OTP đã được gửi. Vui lòng kiểm tra hộp thư.";
    private static final String OTP_ERROR = "Mã OTP không hợp lệ, đã hết hạn hoặc vượt quá số lần thử. Vui lòng yêu cầu mã mới.";
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;
    private final AuthRateLimiter limiter;
    private final GoogleTokenVerifier googleVerifier;
    private String dummyPasswordHash;

    @PostConstruct
    void initializeDummyHash() { dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString()); }

    @Override
    @Transactional
    public MessageResponse register(RegisterRequest request) {
        if (!"STUDENT".equals(request.getRole())) throw new AuthBusinessException("Đăng ký công khai chỉ dành cho Sinh viên");
        String email = normalize(request.getEmail());
        limiter.check("register:" + email, 3, Duration.ofMinutes(15));
        if (userRepository.existsByEmail(email)) return new MessageResponse(REGISTRATION_MESSAGE);
        User user = User.builder().fullName(request.getFullName().trim()).email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.Role.STUDENT).isVerified(false).build();
        String otp = issueOtp(user);
        userRepository.save(user);
        emailService.sendOtpEmail(email, otp);
        return new MessageResponse(REGISTRATION_MESSAGE);
    }

    @Override
    @Transactional(noRollbackFor = AuthBusinessException.class)
    public AuthResponse verifyOtp(VerifyOtpRequest request) {
        String email = normalize(request.getEmail());
        limiter.check("verify:" + email, 10, Duration.ofMinutes(15));
        User user = userRepository.findByEmailForPasswordReset(email)
                .orElseThrow(() -> new AuthBusinessException(OTP_ERROR));
        if (Boolean.TRUE.equals(user.getIsVerified()) || user.getOtpHash() == null
                || user.getOtpExpiry() == null || !LocalDateTime.now().isBefore(user.getOtpExpiry())
                || user.getOtpAttempts() >= 5) throw new AuthBusinessException(OTP_ERROR);
        user.setOtpAttempts(user.getOtpAttempts() + 1);
        if (!passwordEncoder.matches(request.getOtpCode(), user.getOtpHash())) {
            if (user.getOtpAttempts() >= 5) { user.setOtpHash(null); user.setOtpExpiry(null); }
            userRepository.save(user);
            throw new AuthBusinessException(OTP_ERROR);
        }
        user.setIsVerified(true);
        clearOtp(user);
        userRepository.save(user);
        return buildAuthResponse(user);
    }

    @Override
    @Transactional
    public MessageResponse resendOtp(String address) {
        String email = normalize(address);
        limiter.check("resend:" + email, 3, Duration.ofMinutes(15));
        User user = userRepository.findByEmailForPasswordReset(email).orElse(null);
        if (user != null && !Boolean.TRUE.equals(user.getIsVerified())
                && (user.getOtpRequestedAt() == null
                || !LocalDateTime.now().isBefore(user.getOtpRequestedAt().plusSeconds(60)))) {
            String otp = issueOtp(user);
            userRepository.save(user);
            emailService.sendOtpEmail(user.getEmail(), otp);
        }
        return new MessageResponse("Nếu tài khoản cần xác thực, mã OTP đã được gửi. Vui lòng kiểm tra email.");
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = normalize(request.getEmail());
        limiter.check("login:" + email, 10, Duration.ofMinutes(15));
        User user = userRepository.findByEmailForPasswordReset(email).orElse(null);
        String hash = user == null || user.getPasswordHash() == null ? dummyPasswordHash : user.getPasswordHash();
        boolean matches;
        try { matches = passwordEncoder.matches(request.getPassword(), hash); }
        catch (IllegalArgumentException ex) { matches = false; }
        if (user == null || user.getPasswordHash() == null || !matches) throw new AuthBusinessException("Email hoặc mật khẩu không đúng");
        if (!Boolean.TRUE.equals(user.getIsVerified())) throw new AuthBusinessException("Tài khoản chưa được xác thực. Vui lòng xác thực OTP trước.");
        if (passwordEncoder.upgradeEncoding(hash)) user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        return buildAuthResponse(user);
    }

    @Override
    @Transactional
    public AuthResponse googleLogin(GoogleLoginRequest request) {
        var payload = googleVerifier.verify(request.getIdToken());
        if (!Boolean.TRUE.equals(payload.getEmailVerified()) || payload.getEmail() == null
                || payload.getSubject() == null || payload.getSubject().isBlank()) throw new AuthBusinessException("Không thể xác thực tài khoản Google.");
        String email = normalize(payload.getEmail());
        limiter.check("google:" + email, 10, Duration.ofMinutes(15));
        User user = userRepository.findByGoogleId(payload.getSubject()).orElse(null);
        if (user != null) {
            user = userRepository.findByIdForUpdate(user.getUserId()).orElseThrow();
        } else {
            user = userRepository.findByEmailForPasswordReset(email).orElse(null);
            if (user != null) {
                boolean authoritative = email.endsWith("@gmail.com")
                        || (payload.getHostedDomain() != null && !payload.getHostedDomain().isBlank());
                if (!authoritative || (user.getGoogleId() != null && !user.getGoogleId().equals(payload.getSubject()))) {
                    throw new AuthBusinessException("Không thể liên kết Google với tài khoản này. Vui lòng đăng nhập bằng phương thức đã đăng ký.");
                }
                // An unverified signup may have an attacker's password (account pre-hijacking).
                if (!Boolean.TRUE.equals(user.getIsVerified())) {
                    user.setPasswordHash(null);
                    user.setRole(User.Role.STUDENT);
                }
                user.setGoogleId(payload.getSubject());
                user.setAuthVersion(user.getAuthVersion() + 1);
                user.setPasswordResetTokenHash(null);
                user.setPasswordResetExpiry(null);
            } else {
                String fullName = (String) payload.get("name");
                user = User.builder().email(email).googleId(payload.getSubject()).role(User.Role.STUDENT)
                        .fullName(fullName == null ? "Google User" : fullName.substring(0, Math.min(fullName.length(), 100))).build();
            }
        }
        clearOtp(user);
        user.setIsVerified(true);
        String avatar = (String) payload.get("picture");
        if (avatar != null && avatar.length() <= 500 && validAvatar(avatar)) user.setAvatarUrl(avatar);
        return buildAuthResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public void logout(Integer userId) {
        User user = userRepository.findByIdForUpdate(userId).orElseThrow();
        user.setAuthVersion(user.getAuthVersion() + 1);
    }

    @Override
    public AuthResponse.UserInfo getProfile(Integer userId) {
        return toUserInfo(userRepository.findById(userId).orElseThrow(() -> new AuthBusinessException("Không tìm thấy tài khoản")));
    }

    @Override
    @Transactional
    public AuthResponse.UserInfo updateProfile(Integer userId, UpdateProfileRequest request) {
        User user = userRepository.findByIdForUpdate(userId).orElseThrow(() -> new AuthBusinessException("Không tìm thấy tài khoản"));
        user.setFullName(request.getFullName().trim());
        String avatar = request.getAvatarUrl() == null ? "" : request.getAvatarUrl().trim();
        if (!avatar.isEmpty() && !validAvatar(avatar)) throw new AuthBusinessException("Ảnh đại diện cần là đường dẫn HTTPS hợp lệ");
        user.setAvatarUrl(avatar.isEmpty() ? null : avatar);
        return toUserInfo(userRepository.save(user));
    }

    private boolean validAvatar(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException ex) { return false; }
    }

    private String issueOtp(User user) {
        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        user.setOtpCode(null);
        user.setOtpHash(passwordEncoder.encode(otp));
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(5));
        user.setOtpRequestedAt(LocalDateTime.now());
        user.setOtpAttempts(0);
        return otp;
    }

    private void clearOtp(User user) {
        user.setOtpCode(null);
        user.setOtpHash(null);
        user.setOtpExpiry(null);
        user.setOtpAttempts(0);
    }

    private String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }

    private AuthResponse buildAuthResponse(User user) {
        return AuthResponse.builder().accessToken(jwtTokenProvider.generateToken(user.getUserId(),
                user.getEmail(), user.getRole().name(), user.getAuthVersion()))
                .tokenType("Bearer").user(toUserInfo(user)).build();
    }

    private AuthResponse.UserInfo toUserInfo(User user) {
        return AuthResponse.UserInfo.builder().userId(user.getUserId()).fullName(user.getFullName())
                .email(user.getEmail()).role(user.getRole().name()).avatarUrl(user.getAvatarUrl())
                .isVerified(user.getIsVerified()).build();
    }
}
