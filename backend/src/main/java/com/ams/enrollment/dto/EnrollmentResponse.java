package com.ams.enrollment.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record EnrollmentResponse(Long enrollmentId, Integer courseId, String courseTitle, String status,
        Long paymentId, String paymentStatus, BigDecimal amount, String orderCode,
        String bank, String accountNumber, String transferContent, String qrUrl, Instant expiresAt) {}
