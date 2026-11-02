package com.ams.assignment.controller;

import com.ams.assignment.service.StudentAssignmentService;
import com.ams.assignment.dto.AssignmentDtos.QuizSubmit;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/student/assignments")
@RequiredArgsConstructor
public class StudentAssignmentController {
    private final StudentAssignmentService service;

    @GetMapping
    public List<Map<String, Object>> list(Authentication auth) {
        return service.list(auth);
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable Integer id, Authentication auth) {
        return service.detail(id, auth);
    }

    @PostMapping("/{id}/attempts")
    public Map<String, Object> submit(@PathVariable Integer id, @Valid @RequestBody QuizSubmit submission, Authentication auth) {
        return service.submit(id, submission, auth);
    }
}
