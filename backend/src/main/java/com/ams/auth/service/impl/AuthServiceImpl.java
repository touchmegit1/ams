package com.ams.auth.service.impl;

import com.ams.auth.dto.request.GoogleLoginRequest;
import com.ams.auth.dto.request.LoginRequest;
import com.ams.auth.dto.request.RegisterRequest;
import com.ams.auth.dto.request.VerifyOtpRequest;
import com.ams.auth.dto.response.AuthResponse;
import com.ams.auth.dto.response.MessageResponse;
import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import com.ams.auth.security.JwtTokenProvider;
import com.ams.auth.service.AuthService;
import com.ams.auth.service.EmailService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;

    @Value("${google.client-id:}")
    private String googleClientId;

    // ======================== REGISTER ========================

    @Override
    @Transactional
    public MessageResponse register(RegisterRequest request) {
        // Kiểm tra email đã tồn tại chưa
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email đã được sử dụng");
        }

        // Tạo OTP
        String otpCode = generateOtp();

        // Tạo User mới (chưa verified)
        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.Role.valueOf(request.getRole().toUpperCase()))
                .otpCode(otpCode)
                .otpExpiry(LocalDateTime.now().plusMinutes(5))
                .isVerified(false)
                .build();

        userRepository.save(user);

        // Gửi OTP qua email
        emailService.sendOtpEmail(request.getEmail(), otpCode);

        return new MessageResponse("Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP xác thực.");
    }

    // ======================== VERIFY OTP ========================

    @Override
    @Transactional
    public AuthResponse verifyOtp(VerifyOtpRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản với email này"));

        // Kiểm tra OTP
        if (user.getOtpCode() == null || !user.getOtpCode().equals(request.getOtpCode())) {
            throw new RuntimeException("Mã OTP không đúng");
        }

        // Kiểm tra hết hạn
        if (user.getOtpExpiry() == null || LocalDateTime.now().isAfter(user.getOtpExpiry())) {
            throw new RuntimeException("Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại.");
        }

        // Xác thực thành công
        user.setIsVerified(true);
        user.setOtpCode(null);
        user.setOtpExpiry(null);
        userRepository.save(user);

        // Tạo JWT và trả về
        return buildAuthResponse(user);
    }

    // ======================== RESEND OTP ========================

    @Override
    @Transactional
    public MessageResponse resendOtp(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản với email này"));

        if (Boolean.TRUE.equals(user.getIsVerified())) {
            throw new RuntimeException("Tài khoản đã được xác thực rồi");
        }

        String otpCode = generateOtp();
        user.setOtpCode(otpCode);
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(5));
        userRepository.save(user);

        emailService.sendOtpEmail(email, otpCode);

        return new MessageResponse("Đã gửi lại mã OTP. Vui lòng kiểm tra email.");
    }

    // ======================== LOGIN ========================

    @Override
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Email hoặc mật khẩu không đúng"));

        // Nếu user đăng ký bằng Google (password_hash = null)
        if (user.getPasswordHash() == null) {
            throw new RuntimeException("Tài khoản này được đăng ký bằng Google. Vui lòng đăng nhập bằng Google.");
        }

        // Kiểm tra mật khẩu
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Email hoặc mật khẩu không đúng");
        }

        // Kiểm tra đã verify OTP chưa
        if (!Boolean.TRUE.equals(user.getIsVerified())) {
            throw new RuntimeException("Tài khoản chưa được xác thực. Vui lòng xác thực OTP trước.");
        }

        return buildAuthResponse(user);
    }

    // ======================== GOOGLE LOGIN ========================

    @Override
    @Transactional
    public AuthResponse googleLogin(GoogleLoginRequest request) {
        try {
            // Verify Google ID Token
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(request.getIdToken());
            if (idToken == null) {
                throw new RuntimeException("Google ID Token không hợp lệ");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String googleId = payload.getSubject();
            String email = payload.getEmail();
            String fullName = (String) payload.get("name");
            String avatarUrl = (String) payload.get("picture");

            // Tìm user theo googleId hoặc email
            User user = userRepository.findByGoogleId(googleId)
                    .orElseGet(() -> userRepository.findByEmail(email)
                            .orElse(null));

            if (user == null) {
                // Tạo tài khoản mới từ Google
                user = User.builder()
                        .fullName(fullName != null ? fullName : "Google User")
                        .email(email)
                        .googleId(googleId)
                        .avatarUrl(avatarUrl)
                        .role(User.Role.STUDENT)
                        .isVerified(true) // Google đã verify email
                        .build();
                user = userRepository.save(user);
            } else {
                // Cập nhật thông tin Google nếu chưa có
                if (user.getGoogleId() == null) {
                    user.setGoogleId(googleId);
                }
                if (avatarUrl != null) {
                    user.setAvatarUrl(avatarUrl);
                }
                user.setIsVerified(true);
                user = userRepository.save(user);
            }

            return buildAuthResponse(user);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi xác thực Google: {}", e.getMessage());
            throw new RuntimeException("Không thể xác thực với Google. Vui lòng thử lại.");
        }
    }

    // ======================== HELPERS ========================

    private AuthResponse buildAuthResponse(User user) {
        String token = jwtTokenProvider.generateToken(
                user.getUserId(), user.getEmail(), user.getRole().name());

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .user(AuthResponse.UserInfo.builder()
                        .userId(user.getUserId())
                        .fullName(user.getFullName())
                        .email(user.getEmail())
                        .role(user.getRole().name())
                        .avatarUrl(user.getAvatarUrl())
                        .isVerified(user.getIsVerified())
                        .build())
                .build();
    }

    private String generateOtp() {
        return String.format("%06d", new Random().nextInt(999999));
    }
}
