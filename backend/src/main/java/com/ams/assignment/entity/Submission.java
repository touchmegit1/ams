package com.ams.assignment.entity;

import com.ams.auth.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "submissions")
@Getter
@Setter
public class Submission {
    public enum Status { SUBMITTED, AI_EVALUATED, TEACHER_REVIEWED }
    public enum AiEvaluationStatus { NOT_REQUIRED, PENDING, COMPLETED, FAILED, UNSUPPORTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "submission_id")
    private Integer submissionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private Assignment assignment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "submission_text", nullable = false, columnDefinition = "LONGTEXT")
    private String submissionText = "";

    @Column(name = "file_url", length = 500)
    private String fileKey;

    @Column(name = "original_file_name", length = 255)
    private String originalFileName;

    @Column(name = "ai_score", precision = 5, scale = 2)
    private BigDecimal aiScore;

    @Column(name = "auto_score", precision = 5, scale = 2)
    private BigDecimal autoScore;

    @Column(name = "ai_feedback", columnDefinition = "TEXT")
    private String aiFeedback;

    @Column(name = "auto_feedback", columnDefinition = "TEXT")
    private String autoFeedback;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_evaluation_status", length = 20)
    private AiEvaluationStatus aiEvaluationStatus = AiEvaluationStatus.NOT_REQUIRED;

    @Column(name = "ai_evaluated_at")
    private Instant aiEvaluatedAt;

    @Column(name = "teacher_score", precision = 5, scale = 2)
    private BigDecimal teacherScore;

    @Column(name = "teacher_feedback", columnDefinition = "TEXT")
    private String teacherFeedback;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.SUBMITTED;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Version
    @Column(name = "submission_version", nullable = false)
    private Long version;

    @PrePersist
    void setSubmittedTimestamp() { if (submittedAt == null) submittedAt = Instant.now(); }
}
