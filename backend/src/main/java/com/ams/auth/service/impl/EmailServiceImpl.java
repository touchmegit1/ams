package com.ams.auth.service.impl;

import com.ams.auth.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Override
    public void sendOtpEmail(String toEmail, String otpCode) {
        // Log OTP ra console (backup)
        log.info("========================================");
        log.info("  OTP cho {}: {}", toEmail, otpCode);
        log.info("========================================");

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "utf-8");

            helper.setFrom(new InternetAddress(fromEmail, "AMS System"));
            helper.setTo(toEmail);
            helper.setSubject("[AMS] Mã xác thực tài khoản");
            helper.setText(
                "Xin chào,\n\n"
                + "Mã OTP xác thực tài khoản AMS của bạn là: " + otpCode + "\n\n"
                + "Mã có hiệu lực trong 5 phút.\n"
                + "Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này.\n\n"
                + "Trân trọng,\nAMS Team"
            );

            mailSender.send(mimeMessage);
            log.info("Đã gửi OTP qua email từ {} đến {}", fromEmail, toEmail);

        } catch (Exception e) {
            log.error("Lỗi gửi email OTP đến {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Không thể gửi email OTP. Vui lòng thử lại sau.");
        }
    }
}
