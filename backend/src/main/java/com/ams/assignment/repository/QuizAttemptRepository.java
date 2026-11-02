package com.ams.assignment.repository;

import com.ams.assignment.entity.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    List<QuizAttempt> findAllByAssignmentIdAndStudentIdOrderBySubmittedAtDesc(Integer assignmentId, Integer studentId);
    List<QuizAttempt> findAllByStudentId(Integer studentId);
    List<QuizAttempt> findAllByAssignmentIdInOrderBySubmittedAtDesc(java.util.Collection<Integer> assignmentIds);
    @Query("select a from QuizAttempt a join Assignment x on x.id = a.assignmentId where x.subjectId = :courseId and a.studentId = :studentId")
    List<QuizAttempt> findCourseAttempts(@Param("courseId") Integer courseId, @Param("studentId") Integer studentId);
}
