package com.ams.coursemgmt.controller;

import com.ams.coursemgmt.dto.request.CourseRequest;
import com.ams.coursemgmt.dto.response.CourseResponse;
import com.ams.coursemgmt.service.CourseManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseManagementService courseService;

    public CourseController(CourseManagementService courseService) {
        this.courseService = courseService;
    }

    @GetMapping
    public List<CourseResponse> list(Authentication authentication) {
        return courseService.listCourses(actorId(authentication));
    }

    @PostMapping
    public ResponseEntity<CourseResponse> create(Authentication authentication,
                                                 @Valid @RequestBody CourseRequest request) {
        CourseResponse created = courseService.createCourse(actorId(authentication), request);
        return ResponseEntity.created(URI.create("/api/courses/" + created.courseId())).body(created);
    }

    @GetMapping("/{courseId}")
    public CourseResponse get(Authentication authentication, @PathVariable Integer courseId) {
        return courseService.getCourse(actorId(authentication), courseId);
    }

    @PutMapping("/{courseId}")
    public CourseResponse update(Authentication authentication, @PathVariable Integer courseId,
                                 @Valid @RequestBody CourseRequest request) {
        return courseService.updateCourse(actorId(authentication), courseId, request);
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Integer courseId) {
        courseService.deleteCourse(actorId(authentication), courseId);
        return ResponseEntity.noContent().build();
    }

    private Integer actorId(Authentication authentication) {
        return Integer.valueOf(authentication.getName());
    }
}
