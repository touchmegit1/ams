package com.ams.assignment.entity;

import com.ams.auth.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "submissions", indexes = {
    @Index(name = "idx_submission_assignment_student_attempt", columnList = "assignment_id,student_id,attempt_number"),
    @Index(name = "idx_submission_assignment_status", columnList = "assignment_id,status")
})
@Getter @Setter
public class Submission {
    public enum Status { SUBMITTED, EVALUATING, EVALUATED, AI_FAILED, TEACHER_REVIEWED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "submission_id") private Integer id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false) private Assignment assignment;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false) private User student;
    @Column(name = "submission_text", nullable = false, columnDefinition = "LONGTEXT") private String submissionText = "";
    @Column(name = "file_url", length = 500) private String fileUrl;
    @Column(name = "ai_score", precision = 5, scale = 2) private BigDecimal aiScore;
    @Column(name = "ai_feedback", columnDefinition = "LONGTEXT") private String aiFeedback;
    @Column(name = "ai_evaluated_at") private LocalDateTime aiEvaluatedAt;
    @Column(name = "teacher_score", precision = 5, scale = 2) private BigDecimal teacherScore;
    @Column(name = "teacher_feedback", columnDefinition = "TEXT") private String teacherFeedback;
    @Column(name = "teacher_reviewed_at") private LocalDateTime teacherReviewedAt;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) private Status status = Status.SUBMITTED;
    @Column(name = "submitted_at", nullable = false) private LocalDateTime submittedAt;
    @Column(name = "attempt_number", nullable = false) private Integer attemptNumber = 1;
    @Column(name = "rubric_snapshot", columnDefinition = "LONGTEXT") private String rubricSnapshot;
    @Column(name = "evaluation_error", length = 1000) private String evaluationError;
    @Version private Long version;

    @PrePersist void initialize() { if (submittedAt == null) submittedAt = LocalDateTime.now(); }
}
