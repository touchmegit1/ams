package com.ams.assignment.repository;
import com.ams.assignment.entity.AssignmentTemplate;
import org.springframework.data.jpa.repository.*;
public interface AssignmentTemplateRepository extends JpaRepository<AssignmentTemplate, Integer>, JpaSpecificationExecutor<AssignmentTemplate> {
    @Modifying @Query("update AssignmentTemplate t set t.usageCount = t.usageCount + 1 where t.id = :id")
    void incrementUsage(Integer id);
}
