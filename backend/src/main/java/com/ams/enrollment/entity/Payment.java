package com.ams.enrollment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "enrollment_payments", indexes = @Index(name = "idx_payment_enrollment", columnList = "enrollment_id"))
@Getter @Setter
public class Payment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrollment_id", nullable = false)
    private Enrollment enrollment;
    @Column(nullable = false, unique = true, length = 20)
    private String orderCode;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(nullable = false, length = 30)
    private String accountNumber;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.PENDING;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant expiresAt;
    private Instant paidAt;
    @Column(unique = true)
    private Long sepayTransactionId;
}
