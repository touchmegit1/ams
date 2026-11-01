package com.ams.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import jakarta.validation.constraints.Size;

@Data
public class GoogleLoginRequest {

    /** ID Token nhận được từ Google Sign-In phía client */
    @NotBlank(message = "Google ID Token không được để trống")
    @Size(max = 8192)
    private String idToken;
}
