package com.ams.enrollment.repository;

import com.ams.enrollment.entity.PaymentReview;
import com.ams.enrollment.entity.ReviewStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PaymentReviewRepository extends JpaRepository<PaymentReview, Long> {
    boolean existsBySepayTransactionId(Long transactionId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PaymentReview r where r.sepayTransactionId = :transactionId")
    Optional<PaymentReview> findBySepayTransactionIdForUpdate(Long transactionId);
    List<PaymentReview> findAllByStatusOrderByCreatedAtDesc(ReviewStatus status);
}
