package com.ams.enrollment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payment_reviews")
@Getter @Setter
public class PaymentReview {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private Long sepayTransactionId;
    private String orderCode;
    private String accountNumber;
    @Column(precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(nullable = false, length = 80)
    private String reason;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private ReviewStatus status = ReviewStatus.OPEN;
    @Column(length = 1000)
    private String note;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant closedAt;
}
