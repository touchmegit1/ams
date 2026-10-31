package com.ams.assignment.repository;
import com.ams.assignment.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface CourseRepository extends JpaRepository<Course, Integer> {
    List<Course> findByTeacherIdOrderByTitle(Integer teacherId);
}
