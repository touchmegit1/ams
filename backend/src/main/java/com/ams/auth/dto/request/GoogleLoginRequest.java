package com.ams.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GoogleLoginRequest {

    /** ID Token nhận được từ Google Sign-In phía client */
    @NotBlank(message = "Google ID Token không được để trống")
    private String idToken;
}
