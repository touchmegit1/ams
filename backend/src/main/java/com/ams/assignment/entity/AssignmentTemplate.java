package com.ams.assignment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name = "assignment_templates") @Getter @Setter
public class AssignmentTemplate {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "template_id") private Integer id;
    @Column(nullable = false, length = 200) private String name;
    @Column(name = "course_id") private Integer subjectId;
    @Column(nullable = false, columnDefinition = "TEXT") private String description;
    @Column(name = "default_max_score", precision = 5, scale = 2) private BigDecimal defaultMaxScore;
    @Column(name = "default_rubric", nullable = false, columnDefinition = "TEXT") private String rubricJson;
    @Column(name = "created_by", nullable = false) private Integer createdBy;
    @Column(name = "usage_count", nullable = false) private int usageCount;
    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @PrePersist void create() { createdAt = updatedAt = LocalDateTime.now(); }
}
