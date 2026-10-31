package com.ams.assignment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Shared courses table owned by the course module; subject means course. */
@Entity @Table(name = "courses") @Getter @Setter
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "course_id")
    private Integer id;
    @Column(name = "teacher_id", nullable = false) private Integer teacherId;
    @Column(nullable = false, length = 200) private String title;
}
