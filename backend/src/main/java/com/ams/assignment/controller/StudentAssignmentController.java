package com.ams.assignment.controller;

import com.ams.assignment.service.StudentAssignmentService;
import com.ams.assignment.service.SubmissionService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/student/assignments")
public class StudentAssignmentController {
    private final StudentAssignmentService service;
    private final SubmissionService submissions;

    public StudentAssignmentController(StudentAssignmentService service, SubmissionService submissions) {
        this.service = service; this.submissions = submissions;
    }

    @GetMapping
    public List<Map<String, Object>> list(Authentication auth) {
        return service.list(auth);
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable Integer id, Authentication auth) {
        return service.detail(id, auth);
    }

    @GetMapping("/{id}/submission")
    public Map<String, Object> submission(@PathVariable Integer id, Authentication auth) { return submissions.studentSubmission(id, auth.getName()); }

    @PostMapping(value="/{id}/submission", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public Map<String, Object> submit(@PathVariable Integer id, @RequestParam(required=false) String submissionText,
                                      @RequestPart(required=false) MultipartFile file, Authentication auth) {
        return submissions.submit(id, submissionText, file, auth.getName());
    }

    @GetMapping("/{id}/submission/file")
    public ResponseEntity<FileSystemResource> submissionFile(@PathVariable Integer id, Authentication auth) throws java.io.IOException {
        var file = submissions.studentDownload(id, auth.getName());
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(file.originalName(), StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.APPLICATION_OCTET_STREAM).body(new FileSystemResource(file.path()));
    }

    @GetMapping("/{id}/resource-file")
    public ResponseEntity<FileSystemResource> resourceFile(@PathVariable Integer id, Authentication auth) {
        var file = service.downloadResourceFile(id, auth);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(file.originalName(), StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.APPLICATION_OCTET_STREAM).body(new FileSystemResource(file.path()));
    }
}
