package com.ams.auth.controller;

import com.ams.auth.dto.request.GoogleLoginRequest;
import com.ams.auth.dto.request.LoginRequest;
import com.ams.auth.dto.request.RegisterRequest;
import com.ams.auth.dto.request.VerifyOtpRequest;
import com.ams.auth.dto.request.UpdateProfileRequest;
import com.ams.auth.dto.response.AuthResponse;
import com.ams.auth.dto.response.MessageResponse;
import com.ams.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/register
     * Đăng ký tài khoản mới — gửi OTP qua email
     */
    @PostMapping("/register")
    public ResponseEntity<MessageResponse> register(@Valid @RequestBody RegisterRequest request) {
        MessageResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * POST /api/auth/verify-otp
     * Xác thực mã OTP sau đăng ký
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<AuthResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        AuthResponse response = authService.verifyOtp(request);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/auth/resend-otp?email=xxx
     * Gửi lại mã OTP
     */
    @PostMapping("/resend-otp")
    public ResponseEntity<MessageResponse> resendOtp(@RequestParam String email) {
        MessageResponse response = authService.resendOtp(email);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/auth/login
     * Đăng nhập bằng email + password
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/auth/google-login
     * Đăng nhập / đăng ký bằng Google ID Token
     */
    @PostMapping("/google-login")
    public ResponseEntity<AuthResponse> googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
        AuthResponse response = authService.googleLogin(request);
        return ResponseEntity.ok(response);
    }
    @GetMapping("/profile")
    public ResponseEntity<AuthResponse.UserInfo> getProfile(Authentication authentication) {
        return ResponseEntity.ok(authService.getProfile((Integer) authentication.getPrincipal()));
    }

    @PatchMapping("/profile")
    public ResponseEntity<AuthResponse.UserInfo> updateProfile(Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile((Integer) authentication.getPrincipal(), request));
    }
}
