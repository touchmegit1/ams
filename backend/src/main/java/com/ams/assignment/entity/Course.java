package com.ams.assignment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import com.ams.coursemgmt.entity.CourseStatus;
import java.math.BigDecimal;

/** Shared courses table owned by the course module; subject means course. */
@Entity(name = "AssignmentCourse") @Table(name = "courses") @Getter @Setter
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "course_id")
    private Integer id;
    @Column(name = "teacher_id", nullable = false) private Integer teacherId;
    @Column(nullable = false, length = 200) private String title;
    @Column(nullable = false, precision = 10, scale = 2) private BigDecimal price = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private CourseStatus status = CourseStatus.DRAFT;
}
