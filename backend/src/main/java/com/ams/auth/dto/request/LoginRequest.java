package com.ams.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import jakarta.validation.constraints.Size;

@Data
public class LoginRequest {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    @Size(max = 150)
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(max = 256, message = "Mật khẩu quá dài")
    private String password;
}
