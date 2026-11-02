package com.ams.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank(message = "Vui lòng nhập họ tên")
    @Size(max = 100, message = "Họ tên không được quá 100 ký tự")
    private String fullName;

    @Size(max = 500, message = "Đường dẫn ảnh không được quá 500 ký tự")
    private String avatarUrl;
}
