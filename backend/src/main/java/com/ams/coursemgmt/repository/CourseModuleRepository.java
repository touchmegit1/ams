package com.ams.coursemgmt.repository;

import com.ams.coursemgmt.entity.CourseModule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CourseModuleRepository extends JpaRepository<CourseModule, Integer> {
    List<CourseModule> findAllByCourse_CourseIdOrderByOrderIndexAscModuleIdAsc(Integer courseId);
    long countByCourse_CourseId(Integer courseId);

    @Query("select coalesce(max(m.orderIndex), 0) from CourseModule m where m.course.courseId = :courseId")
    int findMaxOrderIndex(@Param("courseId") Integer courseId);
}
