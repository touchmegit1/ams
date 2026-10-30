package com.ams.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Data
public class VerifyOtpRequest {

    @NotBlank(message = "Email không được để trống")
    @Email
    @Size(max = 150)
    private String email;

    @NotBlank(message = "Mã OTP không được để trống")
    @Pattern(regexp = "[0-9]{6}", message = "Mã OTP phải gồm 6 chữ số")
    private String otpCode;
}
