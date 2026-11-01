package com.ams.enrollment.controller;

import com.ams.enrollment.dto.EnrollmentResponse;
import com.ams.enrollment.service.EnrollmentService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/enrollments")
public class EnrollmentController {
    private final EnrollmentService service;
    public EnrollmentController(EnrollmentService service) { this.service = service; }
    @PostMapping("/courses/{courseId}")
    public EnrollmentResponse enroll(Authentication auth, @PathVariable Integer courseId) {
        return service.enroll(Integer.valueOf(auth.getName()), courseId);
    }
    @GetMapping
    public List<EnrollmentResponse> list(Authentication auth) { return service.list(Integer.valueOf(auth.getName())); }
    @GetMapping("/{id}")
    public EnrollmentResponse get(Authentication auth, @PathVariable Long id) { return service.get(Integer.valueOf(auth.getName()), id); }
}
