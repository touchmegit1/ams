package com.ams.coursemgmt.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ModuleRequest(
        @NotBlank @Size(max = 200) String title,
        @Positive Integer orderIndex
) {}
