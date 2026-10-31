package com.ams.coursemgmt.dto.request;

import com.ams.coursemgmt.entity.CourseStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CourseRequest(
        @NotBlank @Size(max = 32) String courseCode,
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 120) String subject,
        @Size(max = 200) String targetAudience,
        @Size(max = 10000) String description,
        @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal price,
        CourseStatus status
) {}
