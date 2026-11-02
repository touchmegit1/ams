package com.ams.coursemgmt.entity;

import com.ams.auth.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "lesson_progress", uniqueConstraints = @UniqueConstraint(name = "uk_lesson_progress_student_lesson", columnNames = {"student_id", "lesson_id"}),
       indexes = @Index(name = "idx_lesson_progress_course_lesson", columnList = "lesson_id"))
@Getter @Setter @NoArgsConstructor
public class LessonProgress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "progress_id") private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "student_id", nullable = false)
    private User student;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "lesson_id", nullable = false)
    private Lesson lesson;
    @Column(name = "completed_at", nullable = false) private LocalDateTime completedAt;
    @PrePersist void markCompleted() { if (completedAt == null) completedAt = LocalDateTime.now(); }
}
