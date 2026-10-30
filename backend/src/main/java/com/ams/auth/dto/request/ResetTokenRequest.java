package com.ams.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ResetTokenRequest {
    @NotBlank(message = "Thiếu liên kết đặt lại mật khẩu")
    @Pattern(regexp = "[A-Za-z0-9_-]{43}", message = "Liên kết đặt lại mật khẩu không hợp lệ")
    private String token;
}
