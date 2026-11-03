package com.ams.assignment.config;
import com.ams.assignment.repository.AssignmentRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
@Configuration @EnableScheduling @RequiredArgsConstructor
public class AssignmentDeadlineJob {
    private final AssignmentRepository assignments;
    private final JdbcTemplate jdbc;
    @Scheduled(fixedDelayString="${assignments.deadline-check-ms:60000}") @Transactional
    public void closeExpired() { assignments.closeExpired(LocalDateTime.now()); }

    @PostConstruct
    @Transactional
    public void initDefaultAllowedFileTypes() {
        try { jdbc.execute("ALTER TABLE submissions MODIFY COLUMN attempt_number INT DEFAULT 1"); } catch (Exception ignored) { }
        try { jdbc.execute("ALTER TABLE submissions MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED'"); } catch (Exception ignored) { }
        try { jdbc.execute("ALTER TABLE submissions MODIFY COLUMN ai_evaluation_status VARCHAR(30) DEFAULT 'NOT_REQUIRED'"); } catch (Exception ignored) { }
        try { jdbc.execute("ALTER TABLE submissions MODIFY COLUMN submission_version BIGINT NOT NULL DEFAULT 0"); } catch (Exception ignored) { }

        assignments.findAll().forEach(a -> {
            if (!"QUIZ".equals(a.getAssignmentType()) && (a.getAllowedFileTypes() == null || a.getAllowedFileTypes().isBlank())) {
                a.setAllowedFileTypes("PDF,DOC,DOCX,ZIP,TXT");
                assignments.save(a);
            }
        });
    }
}
