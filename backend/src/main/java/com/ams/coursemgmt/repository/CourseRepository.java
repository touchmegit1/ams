package com.ams.coursemgmt.repository;

import com.ams.coursemgmt.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Integer> {
    List<Course> findAllByTeacher_UserIdOrderByCreatedAtDesc(Integer teacherId);
    List<Course> findAllByOrderByCreatedAtDesc();
    boolean existsByCourseCodeIgnoreCase(String courseCode);
    boolean existsByCourseCodeIgnoreCaseAndCourseIdNot(String courseCode, Integer courseId);
}
