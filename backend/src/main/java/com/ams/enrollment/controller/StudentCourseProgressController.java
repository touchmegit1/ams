package com.ams.enrollment.controller;

import com.ams.enrollment.service.StudentCourseProgressService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class StudentCourseProgressController {
    private final StudentCourseProgressService service;

    @PostMapping("/api/student/lessons/{lessonId}/complete")
    public Map<String,Object> markComplete(@PathVariable Integer lessonId, Authentication auth) {
        return service.markComplete(lessonId, auth);
    }

    @GetMapping("/api/student/courses/{courseId}/progress")
    public Map<String,Object> ownProgress(@PathVariable Integer courseId, Authentication auth) {
        return service.ownProgress(courseId, auth);
    }
}
