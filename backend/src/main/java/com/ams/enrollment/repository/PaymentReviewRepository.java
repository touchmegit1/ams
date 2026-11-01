package com.ams.enrollment.repository;

import com.ams.enrollment.entity.PaymentReview;
import com.ams.enrollment.entity.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaymentReviewRepository extends JpaRepository<PaymentReview, Long> {
    boolean existsBySepayTransactionId(Long transactionId);
    List<PaymentReview> findAllByStatusOrderByCreatedAtDesc(ReviewStatus status);
}
