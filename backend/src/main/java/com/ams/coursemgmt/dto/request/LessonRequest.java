package com.ams.coursemgmt.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record LessonRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 100000) String content,
        @Size(max = 500) @Pattern(regexp = "^(https?://\\S*)?$", message = "Video URL must start with http:// or https://") String videoUrl,
        @Positive Integer orderIndex
) {}
