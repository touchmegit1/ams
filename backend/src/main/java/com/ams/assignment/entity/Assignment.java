package com.ams.assignment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name = "assignments") @Getter @Setter
public class Assignment {
    public enum Status { DRAFT, PUBLISHED, CLOSED, ARCHIVED }
    public enum Source { MANUAL, AI, TEMPLATE }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "assignment_id") private Integer id;
    @Column(name = "course_id", nullable = false) private Integer subjectId;
    @Column(nullable = false, length = 200) private String title;
    @Column(nullable = false, columnDefinition = "TEXT") private String description;
    @Column(name = "grading_rubric", nullable = false, columnDefinition = "TEXT") private String rubricJson;
    @Column(name = "allowed_file_types", length = 100) private String allowedFileTypes;
    @Column(name = "max_score", precision = 5, scale = 2) private BigDecimal maxScore;
    @Column(name = "due_date") private LocalDateTime dueDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Status status = Status.DRAFT;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Source source = Source.MANUAL;
    @Column(name = "template_id") private Integer templateId;
    @Column(name = "created_by") private Integer createdBy;
    @Column(name = "ai_prompt", columnDefinition = "TEXT") private String aiPrompt;
    @Column(name = "created_at", updatable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @Column(name = "assignment_type", length = 20) private String assignmentType = "DOCUMENT";
    @Column(name = "questions_json", columnDefinition = "LONGTEXT") private String questionsJson;
    @Version private Long version;
    @PrePersist void create() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate void update() { updatedAt = LocalDateTime.now(); }
}
