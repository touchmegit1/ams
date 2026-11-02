package com.ams.enrollment.repository;

import com.ams.enrollment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import java.time.Instant;
import com.ams.enrollment.entity.PaymentStatus;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findTopByEnrollment_IdOrderByCreatedAtDescIdDesc(Long enrollmentId);
    Optional<Payment> findByOrderCode(String orderCode);
    boolean existsBySepayTransactionId(Long transactionId);
    List<Payment> findAllByStatusAndExpiresAtBefore(PaymentStatus status, Instant now);
}
