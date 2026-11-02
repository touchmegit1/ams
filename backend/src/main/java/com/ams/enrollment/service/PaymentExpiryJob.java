package com.ams.enrollment.service;

import com.ams.enrollment.entity.*;
import com.ams.enrollment.repository.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Configuration
@EnableScheduling
public class PaymentExpiryJob {
    private final PaymentRepository payments;
    private final EnrollmentRepository enrollments;
    public PaymentExpiryJob(PaymentRepository payments, EnrollmentRepository enrollments) {
        this.payments = payments; this.enrollments = enrollments;
    }
    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void expire() {
        for (Payment payment : payments.findAllByStatusAndExpiresAtBefore(PaymentStatus.PENDING, Instant.now())) {
            Enrollment enrollment = enrollments.findWithLockById(payment.getEnrollment().getId()).orElseThrow();
            if (payment.getStatus() != PaymentStatus.PENDING || Instant.now().isBefore(payment.getExpiresAt())) continue;
            payment.setStatus(PaymentStatus.EXPIRED);
            Payment latest = payments.findTopByEnrollment_IdOrderByCreatedAtDescIdDesc(enrollment.getId()).orElse(null);
            if (latest != null && latest.getId().equals(payment.getId()) && enrollment.getStatus() == EnrollmentStatus.PENDING) {
                enrollment.setStatus(EnrollmentStatus.EXPIRED);
            }
        }
    }
}
