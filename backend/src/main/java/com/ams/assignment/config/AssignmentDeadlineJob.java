package com.ams.assignment.config;
import com.ams.assignment.repository.AssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
@Configuration @EnableScheduling @RequiredArgsConstructor
public class AssignmentDeadlineJob {
    private final AssignmentRepository assignments;
    @Scheduled(fixedDelayString="${assignments.deadline-check-ms:60000}") @Transactional
    public void closeExpired() { assignments.closeExpired(LocalDateTime.now()); }
}
