package com.ams.assignment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Table(name = "submission_files", indexes = @Index(name = "idx_submission_files_submission", columnList = "submission_id"))
@Getter @Setter
public class SubmissionFile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "file_id") private Integer id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false) private Submission submission;
    @Column(name = "original_name", nullable = false, length = 255) private String originalName;
    @Column(name = "storage_key", nullable = false, unique = true, length = 80) private String storageKey;
    @Column(name = "media_type", length = 120) private String mediaType;
    @Column(name = "size_bytes", nullable = false) private Long sizeBytes;
    @Column(name = "sha256", nullable = false, length = 64) private String sha256;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;

    @PrePersist void initialize() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
