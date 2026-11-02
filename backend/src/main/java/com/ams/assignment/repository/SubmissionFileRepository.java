package com.ams.assignment.repository;

import com.ams.assignment.entity.SubmissionFile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SubmissionFileRepository extends JpaRepository<SubmissionFile, Integer> {
    List<SubmissionFile> findAllBySubmission_IdOrderByIdAsc(Integer submissionId);
    Optional<SubmissionFile> findByIdAndSubmission_Id(Integer fileId, Integer submissionId);
}
