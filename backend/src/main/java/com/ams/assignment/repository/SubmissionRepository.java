package com.ams.assignment.repository;

import com.ams.assignment.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {
    Optional<Submission> findTopByAssignment_IdAndStudent_UserIdOrderBySubmittedAtDescSubmissionIdDesc(Integer assignmentId, Integer studentId);

    List<Submission> findAllByAssignment_IdOrderBySubmittedAtAsc(Integer assignmentId);

    long countByAssignment_SubjectIdAndStatusNot(Integer courseId, Submission.Status status);

    List<Submission> findAllByAssignment_SubjectIdAndStatusNot(Integer courseId, Submission.Status status);
}
