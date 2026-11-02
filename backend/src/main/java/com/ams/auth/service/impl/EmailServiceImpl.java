package com.ams.auth.service.impl;

import com.ams.auth.service.EmailService;
import com.ams.auth.exception.AuthBusinessException;
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
    public void sendPasswordResetEmail(String toEmail, String resetUrl) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "utf-8");
            helper.setFrom(new InternetAddress(fromEmail, "AMS System"));
            helper.setTo(toEmail);
            helper.setSubject("[AMS] Đặt lại mật khẩu");
            helper.setText("Xin chào,\n\n"
                    + "Bạn vừa yêu cầu đặt lại mật khẩu tài khoản AMS. Mở liên kết sau:\n"
                    + resetUrl + "\n\n"
                    + "Liên kết có hiệu lực trong 30 phút và chỉ được sử dụng một lần.\n"
                    + "Khi yêu cầu liên kết mới, liên kết cũ sẽ không còn hiệu lực.\n"
                    + "Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn chưa thay đổi.\n\n"
                    + "Trân trọng,\nAMS Team");
            mailSender.send(mimeMessage);
        } catch (Exception ex) {
            // Never log the reset link or token, including mail exception payloads.
            log.error("Không thể gửi email đặt lại mật khẩu ({})", ex.getClass().getSimpleName());
            throw new AuthBusinessException("Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.");
        }
    }

    @Override
    public void sendOtpEmail(String toEmail, String otpCode) {
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

        } catch (Exception e) {
            log.error("Không thể gửi email OTP ({})", e.getClass().getSimpleName());
            throw new AuthBusinessException("Không thể gửi email OTP. Vui lòng thử lại sau.");
        }
    }
}
