package com.ams.coursemgmt.repository;

import com.ams.coursemgmt.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LessonRepository extends JpaRepository<Lesson, Integer> {
    List<Lesson> findAllByModule_ModuleIdOrderByOrderIndexAscLessonIdAsc(Integer moduleId);
    void deleteAllByModule_ModuleId(Integer moduleId);

    @Query("select coalesce(max(l.orderIndex), 0) from Lesson l where l.module.moduleId = :moduleId")
    int findMaxOrderIndex(@Param("moduleId") Integer moduleId);
}
