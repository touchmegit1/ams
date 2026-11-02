package com.ams.coursemgmt.repository;

import com.ams.coursemgmt.entity.LessonProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface LessonProgressRepository extends JpaRepository<LessonProgress, Long> {
    Optional<LessonProgress> findByStudent_UserIdAndLesson_LessonId(Integer studentId, Integer lessonId);
    List<LessonProgress> findAllByLesson_Module_Course_CourseId(Integer courseId);
    List<LessonProgress> findAllByStudent_UserIdAndLesson_Module_Course_CourseId(Integer studentId, Integer courseId);
}
