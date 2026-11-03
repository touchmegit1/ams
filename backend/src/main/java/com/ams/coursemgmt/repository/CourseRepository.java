package com.ams.coursemgmt.repository;

import com.ams.coursemgmt.entity.Course;
import com.ams.coursemgmt.entity.CourseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Integer> {
    List<Course> findAllByTeacher_UserIdOrderByCreatedAtDesc(Integer teacherId);
    List<Course> findAllByOrderByCreatedAtDesc();
    List<Course> findAllByStatusOrderByCreatedAtDesc(CourseStatus status);
    boolean existsByCourseCodeIgnoreCase(String courseCode);
    boolean existsByCourseCodeIgnoreCaseAndCourseIdNot(String courseCode, Integer courseId);
    long countByTeacher_UserId(Integer teacherId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Course c where c.courseId = :id")
    Optional<Course> findLockedById(@Param("id") Integer id);
}
