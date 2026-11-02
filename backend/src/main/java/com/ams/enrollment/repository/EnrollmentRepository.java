package com.ams.enrollment.repository;

import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    Optional<Enrollment> findByStudent_UserIdAndCourse_CourseId(Integer studentId, Integer courseId);
    List<Enrollment> findAllByStudent_UserIdOrderByCreatedAtDesc(Integer studentId);
    List<Enrollment> findAllByCourse_CourseIdOrderByCreatedAtDesc(Integer courseId);
    boolean existsByCourse_CourseId(Integer courseId);
    boolean existsByStudent_UserIdAndCourse_CourseIdAndStatus(Integer studentId, Integer courseId, EnrollmentStatus status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Enrollment e where e.id = :id")
    Optional<Enrollment> findWithLockById(@Param("id") Long id);
}
