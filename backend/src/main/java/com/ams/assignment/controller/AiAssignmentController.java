package com.ams.assignment.controller;
import com.ams.assignment.dto.AssignmentDtos.*;
import com.ams.assignment.service.GeminiAiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/assignments/ai") @RequiredArgsConstructor
public class AiAssignmentController {
    private final GeminiAiService ai;
    @PostMapping("/generate") public Draft generate(@Valid @RequestBody Generate body,Authentication auth) { return ai.generate(body,auth); }
}
