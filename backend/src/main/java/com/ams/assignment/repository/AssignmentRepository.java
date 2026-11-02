package com.ams.assignment.repository;
import com.ams.assignment.entity.Assignment;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
public interface AssignmentRepository extends JpaRepository<Assignment, Integer>, JpaSpecificationExecutor<Assignment> {
    java.util.List<Assignment> findAllByLessonIdOrderByUpdatedAtDesc(Integer lessonId);
    java.util.List<Assignment> findAllBySubjectIdAndStatusInOrderByDueDateAsc(Integer subjectId, java.util.Collection<Assignment.Status> statuses);
    java.util.List<Assignment> findAllBySubjectIdIn(java.util.Collection<Integer> subjectIds);
    @Modifying @Query("update Assignment a set a.status = :closed, a.updatedAt = :now, a.version = a.version + 1 where a.status = :published and a.dueDate <= :now")
    int updateExpired(LocalDateTime now, Assignment.Status closed, Assignment.Status published);
    default int closeExpired(LocalDateTime now) { return updateExpired(now, Assignment.Status.CLOSED, Assignment.Status.PUBLISHED); }
}
