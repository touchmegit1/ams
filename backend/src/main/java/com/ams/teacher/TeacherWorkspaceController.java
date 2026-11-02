package com.ams.teacher;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teacher/courses")
public class TeacherWorkspaceController {
    private final TeacherWorkspaceService service;
    public TeacherWorkspaceController(TeacherWorkspaceService service) { this.service = service; }

    @GetMapping public List<Map<String, Object>> courses(Authentication auth) { return service.listCourses(auth); }
    @GetMapping("/{courseId}/students") public List<Map<String, Object>> students(@PathVariable Integer courseId, Authentication auth) { return service.students(courseId, auth); }
    @GetMapping("/{courseId}/payments") public Map<String, Object> payments(@PathVariable Integer courseId, Authentication auth) { return service.paymentSummary(courseId, auth); }
}
