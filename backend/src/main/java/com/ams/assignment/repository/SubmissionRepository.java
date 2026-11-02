package com.ams.assignment.repository;

import com.ams.assignment.entity.Submission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {
    Optional<Submission> findFirstByAssignment_IdAndStudent_UserIdOrderByAttemptNumberDescIdDesc(Integer assignmentId, Integer studentId);
    List<Submission> findAllByAssignment_IdAndStudent_UserIdOrderByAttemptNumberAsc(Integer assignmentId, Integer studentId);
    Optional<Submission> findByIdAndStudent_UserId(Integer submissionId, Integer studentId);
    Page<Submission> findAllByAssignment_IdOrderBySubmittedAtDescIdDesc(Integer assignmentId, Pageable pageable);
    boolean existsByAssignment_IdAndStudent_UserId(Integer assignmentId, Integer studentId);
}
