package com.ams.auth.service;

public interface EmailService {

    /** Gửi OTP qua Gmail SMTP */
    void sendOtpEmail(String toEmail, String otpCode);
}
