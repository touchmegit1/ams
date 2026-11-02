package com.ams.auth.service;

import com.ams.auth.dto.request.GoogleLoginRequest;
import com.ams.auth.dto.request.LoginRequest;
import com.ams.auth.dto.request.RegisterRequest;
import com.ams.auth.dto.request.VerifyOtpRequest;
import com.ams.auth.dto.request.UpdateProfileRequest;
import com.ams.auth.dto.response.AuthResponse;
import com.ams.auth.dto.response.MessageResponse;

public interface AuthService {
    void logout(Integer userId);

    /** Đăng ký tài khoản mới — gửi OTP qua email */
    MessageResponse register(RegisterRequest request);

    /** Xác thực OTP */
    AuthResponse verifyOtp(VerifyOtpRequest request);

    /** Gửi lại OTP */
    MessageResponse resendOtp(String email);

    /** Đăng nhập bằng email + password */
    AuthResponse login(LoginRequest request);

    /** Đăng nhập / Đăng ký bằng Google ID Token */
    AuthResponse googleLogin(GoogleLoginRequest request);
    AuthResponse.UserInfo getProfile(Integer userId);

    AuthResponse.UserInfo updateProfile(Integer userId, UpdateProfileRequest request);
}
