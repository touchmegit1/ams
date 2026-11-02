package com.ams.assignment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "quiz_attempts", indexes = {
    @Index(name = "idx_quiz_attempt_student_assignment", columnList = "student_id, assignment_id")
})
@Getter @Setter
public class QuizAttempt {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "attempt_id") private Long id;
    @Column(name = "assignment_id", nullable = false) private Integer assignmentId;
    @Column(name = "student_id", nullable = false) private Integer studentId;
    @Column(name = "answers_json", nullable = false, columnDefinition = "LONGTEXT") private String answersJson;
    @Column(precision = 7, scale = 2, nullable = false) private BigDecimal score;
    @Column(name = "submitted_at", nullable = false) private LocalDateTime submittedAt;
    @PrePersist void submitted() { if (submittedAt == null) submittedAt = LocalDateTime.now(); }
}
