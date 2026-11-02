package com.ams.assignment.controller;

import com.ams.assignment.service.SubmissionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@Validated
@RequiredArgsConstructor
public class SubmissionController {
    private final SubmissionService service;
    public record ReviewBody(@DecimalMin("0.00") BigDecimal score, @Size(max=8000) String feedback) {}

    @PostMapping(path="/api/student/assignments/{assignmentId}/submissions", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String,Object>> submit(@PathVariable Integer assignmentId,
            @RequestParam(required=false) String answersJson, @RequestParam(required=false) String notes,
            @RequestPart(required=false) List<MultipartFile> files, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.submit(assignmentId, answersJson, notes, files, auth));
    }
    @GetMapping("/api/student/assignments/{assignmentId}/submissions")
    public Map<String,Object> history(@PathVariable Integer assignmentId, Authentication auth) { return service.history(assignmentId, auth); }
    @GetMapping("/api/student/submissions/{submissionId}")
    public Map<String,Object> result(@PathVariable Integer submissionId, Authentication auth) { return service.result(submissionId, auth); }
    @GetMapping("/api/student/submissions/{submissionId}/files/{fileId}")
    public ResponseEntity<ByteArrayResource> download(@PathVariable Integer submissionId, @PathVariable Integer fileId, Authentication auth) {
        SubmissionService.Download file = service.download(submissionId, fileId, auth);
        String encoded = URLEncoder.encode(file.filename(), StandardCharsets.UTF_8).replace("+", "%20");
        MediaType type;
        try { type = MediaType.parseMediaType(file.mediaType()); } catch(Exception e) { type = MediaType.APPLICATION_OCTET_STREAM; }
        return ResponseEntity.ok().contentType(type).header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
            .contentLength(file.bytes().length).body(new ByteArrayResource(file.bytes()));
    }
    @PostMapping("/api/assignments/{assignmentId}/submissions/{submissionId}/retry")
    public Map<String,Object> retry(@PathVariable Integer assignmentId, @PathVariable Integer submissionId, Authentication auth) {
        return service.retryForAssignment(assignmentId, submissionId, auth);
    }
    @GetMapping("/api/assignments/{assignmentId}/submissions")
    public org.springframework.data.domain.Page<Map<String,Object>> queue(@PathVariable Integer assignmentId,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size, Authentication auth) {
        return service.queue(assignmentId,page,size,auth);
    }
    @PatchMapping("/api/assignments/{assignmentId}/submissions/{submissionId}/review")
    public Map<String,Object> review(@PathVariable Integer assignmentId, @PathVariable Integer submissionId,
            @Valid @RequestBody ReviewBody body, Authentication auth) {
        return service.review(assignmentId,submissionId,new SubmissionService.ReviewRequest(body.score(),body.feedback()),auth);
    }
}
