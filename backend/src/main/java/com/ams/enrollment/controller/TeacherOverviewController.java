package com.ams.enrollment.controller;

import com.ams.enrollment.service.CourseStudentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class TeacherOverviewController {
    private final CourseStudentService students;
    @GetMapping("/api/teacher/overview")
    public Map<String,Object> overview(Authentication auth) { return students.teacherOverview(auth); }
}
