package com.ams.teacher;

import com.ams.assignment.service.SubmissionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teacher")
public class TeacherSubmissionController {
    private final SubmissionService submissions;
    public TeacherSubmissionController(SubmissionService submissions) { this.submissions = submissions; }

    @GetMapping("/assignments/{assignmentId}/submissions")
    public List<Map<String, Object>> submissions(@PathVariable Integer assignmentId, Authentication auth) {
        return submissions.teacherSubmissions(assignmentId, auth);
    }

    @PatchMapping("/assignments/{assignmentId}/submissions/{submissionId}/grade")
    public Map<String, Object> grade(@PathVariable Integer assignmentId, @PathVariable Integer submissionId,
                                     @Valid @RequestBody GradeRequest body, Authentication auth) {
        return submissions.grade(assignmentId, submissionId, body.score(), body.feedback(), auth);
    }

    @GetMapping("/submissions/{submissionId}/file")
    public ResponseEntity<FileSystemResource> submissionFile(@PathVariable Integer submissionId, Authentication auth) {
        var file = submissions.download(submissionId, auth);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,
            org.springframework.http.ContentDisposition.attachment().filename(file.originalName(), StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.APPLICATION_OCTET_STREAM).body(new FileSystemResource(file.path()));
    }

    public record GradeRequest(@NotNull @DecimalMin("0.00") @Digits(integer=3, fraction=2) BigDecimal score, @Size(max=8000) String feedback) { }
}
