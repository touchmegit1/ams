package com.ams.coursemgmt.controller;

import com.ams.coursemgmt.dto.request.LessonRequest;
import com.ams.coursemgmt.dto.request.ModuleRequest;
import com.ams.coursemgmt.dto.request.ReorderRequest;
import com.ams.coursemgmt.dto.response.LessonResponse;
import com.ams.coursemgmt.dto.response.ModuleResponse;
import com.ams.coursemgmt.service.CourseManagementService;
import com.ams.enrollment.service.CourseStudentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/courses/{courseId}")
public class CourseStructureController {

    private final CourseManagementService courseService;
    private final CourseStudentService studentService;

    public CourseStructureController(CourseManagementService courseService, CourseStudentService studentService) {
        this.courseService = courseService;
        this.studentService = studentService;
    }

    @GetMapping("/students")
    public List<java.util.Map<String, Object>> listStudents(Authentication authentication, @PathVariable Integer courseId,
                                                            @RequestParam(required = false) String search,
                                                            @RequestParam(required = false) String status) {
        return studentService.list(courseId, authentication, search, status);
    }

    @GetMapping("/students/{studentId}")
    public java.util.Map<String,Object> studentProgress(Authentication authentication, @PathVariable Integer courseId, @PathVariable Integer studentId) {
        return studentService.student(courseId, studentId, authentication);
    }

    @GetMapping("/analytics")
    public java.util.Map<String,Object> analytics(Authentication authentication, @PathVariable Integer courseId) {
        return studentService.analytics(courseId, authentication);
    }

    @GetMapping("/students/export.csv")
    public ResponseEntity<byte[]> exportStudents(Authentication authentication, @PathVariable Integer courseId,
                                                 @RequestParam(required = false) String search,
                                                 @RequestParam(required = false) String status) {
        byte[] csv = studentService.exportCsv(courseId, authentication, search, status);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=course-" + courseId + "-students.csv")
            .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8")).body(csv);
    }

    @GetMapping("/modules")
    public List<ModuleResponse> listModules(Authentication authentication, @PathVariable Integer courseId) {
        return courseService.listModules(actorId(authentication), courseId);
    }

    @PostMapping("/modules")
    public ResponseEntity<ModuleResponse> createModule(Authentication authentication,
                                                        @PathVariable Integer courseId,
                                                        @Valid @RequestBody ModuleRequest request) {
        ModuleResponse created = courseService.createModule(actorId(authentication), courseId, request);
        return ResponseEntity.created(URI.create("/api/courses/" + courseId + "/modules/" + created.moduleId()))
                .body(created);
    }

    @PutMapping("/modules/order")
    public ResponseEntity<Void> reorderModules(Authentication authentication,
                                               @PathVariable Integer courseId,
                                               @Valid @RequestBody ReorderRequest request) {
        courseService.reorderModules(actorId(authentication), courseId, request.ids());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/modules/{moduleId}")
    public ModuleResponse updateModule(Authentication authentication, @PathVariable Integer courseId,
                                       @PathVariable Integer moduleId,
                                       @Valid @RequestBody ModuleRequest request) {
        return courseService.updateModule(actorId(authentication), courseId, moduleId, request);
    }

    @DeleteMapping("/modules/{moduleId}")
    public ResponseEntity<Void> deleteModule(Authentication authentication, @PathVariable Integer courseId,
                                             @PathVariable Integer moduleId) {
        courseService.deleteModule(actorId(authentication), courseId, moduleId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/modules/{moduleId}/lessons")
    public ResponseEntity<LessonResponse> createLesson(Authentication authentication,
                                                        @PathVariable Integer courseId,
                                                        @PathVariable Integer moduleId,
                                                        @Valid @RequestBody LessonRequest request) {
        LessonResponse created = courseService.createLesson(actorId(authentication), courseId, moduleId, request);
        return ResponseEntity.created(URI.create("/api/courses/" + courseId + "/modules/"
                + moduleId + "/lessons/" + created.lessonId())).body(created);
    }

    @PutMapping("/modules/{moduleId}/lessons/order")
    public ResponseEntity<Void> reorderLessons(Authentication authentication,
                                               @PathVariable Integer courseId,
                                               @PathVariable Integer moduleId,
                                               @Valid @RequestBody ReorderRequest request) {
        courseService.reorderLessons(actorId(authentication), courseId, moduleId, request.ids());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/modules/{moduleId}/lessons/{lessonId}")
    public LessonResponse updateLesson(Authentication authentication, @PathVariable Integer courseId,
                                       @PathVariable Integer moduleId, @PathVariable Integer lessonId,
                                       @Valid @RequestBody LessonRequest request) {
        return courseService.updateLesson(actorId(authentication), courseId, moduleId, lessonId, request);
    }

    @DeleteMapping("/modules/{moduleId}/lessons/{lessonId}")
    public ResponseEntity<Void> deleteLesson(Authentication authentication, @PathVariable Integer courseId,
                                             @PathVariable Integer moduleId, @PathVariable Integer lessonId) {
        courseService.deleteLesson(actorId(authentication), courseId, moduleId, lessonId);
        return ResponseEntity.noContent().build();
    }

    private Integer actorId(Authentication authentication) {
        return Integer.valueOf(authentication.getName());
    }
}
