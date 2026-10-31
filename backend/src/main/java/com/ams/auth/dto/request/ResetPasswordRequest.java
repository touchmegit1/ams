package com.ams.auth.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import com.ams.auth.validation.StrongPassword;

import java.util.Objects;

@Data
public class ResetPasswordRequest {
    @NotBlank(message = "Thiếu liên kết đặt lại mật khẩu")
    @Pattern(regexp = "[A-Za-z0-9_-]{43}", message = "Liên kết đặt lại mật khẩu không hợp lệ")
    private String token;

    @NotBlank(message = "Vui lòng nhập mật khẩu mới")
    @StrongPassword
    private String password;

    @NotBlank(message = "Vui lòng xác nhận mật khẩu mới")
    @Size(max = 128, message = "Mật khẩu xác nhận quá dài")
    private String confirmPassword;

    @AssertTrue(message = "Mật khẩu xác nhận không khớp")
    public boolean isPasswordsMatch() {
        return Objects.equals(password, confirmPassword);
    }
}
