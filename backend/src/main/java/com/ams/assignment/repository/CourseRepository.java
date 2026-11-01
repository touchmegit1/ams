package com.ams.assignment.repository;
import com.ams.assignment.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
@Repository("assignmentCourseRepository")
public interface CourseRepository extends JpaRepository<Course, Integer> {
    List<Course> findByTeacherIdOrderByTitle(Integer teacherId);
}
