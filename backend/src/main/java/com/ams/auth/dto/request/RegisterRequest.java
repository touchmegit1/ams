package com.ams.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import com.ams.auth.validation.StrongPassword;
import jakarta.validation.constraints.Pattern;

@Data
public class RegisterRequest {

    @NotBlank(message = "Họ tên không được để trống")
    @Size(max = 100, message = "Họ tên tối đa 100 ký tự")
    private String fullName;

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    @Size(max = 150)
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    @StrongPassword
    private String password;

    /** Public registration cannot grant teaching privileges. */
    @NotBlank(message = "Vai trò không được để trống")
    @Pattern(regexp = "STUDENT", message = "Đăng ký công khai chỉ dành cho Sinh viên")
    private String role = "STUDENT";
}
