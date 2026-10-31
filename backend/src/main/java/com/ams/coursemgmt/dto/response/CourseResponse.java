package com.ams.coursemgmt.dto.response;

import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CourseResponse(
        Integer courseId,
        String courseCode,
        String title,
        String subject,
        String targetAudience,
        String description,
        BigDecimal price,
        CourseStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CourseResponse from(Course course) {
        return new CourseResponse(course.getCourseId(), course.getCourseCode(), course.getTitle(),
                course.getSubject(), course.getTargetAudience(), course.getDescription(), course.getPrice(),
                course.getStatus(), course.getCreatedAt(), course.getUpdatedAt());
    }
}
