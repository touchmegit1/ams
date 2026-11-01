package com.ams.enrollment.entity;

import com.ams.auth.entity.User;
import com.ams.coursemgmt.entity.Course;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "course_enrollments", uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "course_id"}))
@Getter @Setter
public class Enrollment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private EnrollmentStatus status = EnrollmentStatus.PENDING;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant activatedAt;
}
