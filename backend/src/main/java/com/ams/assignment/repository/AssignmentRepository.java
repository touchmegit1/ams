package com.ams.assignment.repository;

import com.ams.assignment.entity.Assignment;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.List;

public interface AssignmentRepository extends JpaRepository<Assignment, Integer>, JpaSpecificationExecutor<Assignment> {
    @Modifying
    @Query("update Assignment a set a.status = :closed, a.updatedAt = :now, a.version = a.version + 1 where a.status = :published and a.dueDate <= :now")
    int updateExpired(LocalDateTime now, Assignment.Status closed, Assignment.Status published);

    default int closeExpired(LocalDateTime now) {
        return updateExpired(now, Assignment.Status.CLOSED, Assignment.Status.PUBLISHED);
    }

    long countBySubjectId(Integer subjectId);

    List<Assignment> findAllBySubjectId(Integer subjectId);
}
