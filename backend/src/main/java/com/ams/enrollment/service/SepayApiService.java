package com.ams.enrollment.service;

import com.ams.enrollment.entity.Enrollment;
import com.ams.enrollment.entity.EnrollmentStatus;
import com.ams.enrollment.entity.Payment;
import com.ams.enrollment.entity.PaymentStatus;
import com.ams.enrollment.repository.EnrollmentRepository;
import com.ams.enrollment.repository.PaymentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.Instant;
import java.util.Locale;

@Service
public class SepayApiService {
    private static final Logger log = LoggerFactory.getLogger(SepayApiService.class);

    private final ObjectMapper mapper;
    private final PaymentRepository payments;
    private final EnrollmentRepository enrollments;

    @Value("${sepay.api-token:}")
    private String apiToken;

    @Value("${sepay.account-number:VQRQAHKMG5868}")
    private String accountNumber;

    public SepayApiService(ObjectMapper mapper, PaymentRepository payments, EnrollmentRepository enrollments) {
        this.mapper = mapper;
        this.payments = payments;
        this.enrollments = enrollments;
    }

    /**
     * Checks SePay API transactions for any incoming transaction matching the orderCode and amount.
     * Updates payment to PAID and enrollment to ACTIVE if found.
     */
    @Transactional
    public boolean checkAndUpdatePayment(Payment payment) {
        if (payment == null) return false;
        if (payment.getStatus() == PaymentStatus.PAID) return true;
        if (payment.getStatus() != PaymentStatus.PENDING) return false;
        if (apiToken == null || apiToken.isBlank()) return false;

        try {
            String token = apiToken.trim();
            URL url = new URL("https://my.sepay.vn/userapi/transactions/list?limit=25");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                try (InputStream is = conn.getInputStream()) {
                    JsonNode root = mapper.readTree(is);
                    JsonNode transactions = root.path("transactions");
                    if (transactions.isArray()) {
                        String targetCode = payment.getOrderCode().toUpperCase(Locale.ROOT);
                        for (JsonNode tx : transactions) {
                            String content = tx.path("transaction_content").asText("");
                            String code = tx.path("code").asText("");
                            BigDecimal amountIn = BigDecimal.ZERO;
                            try {
                                amountIn = new BigDecimal(tx.path("amount_in").asText("0"));
                            } catch (Exception ignored) {}

                            boolean matchesCode = (code != null && code.toUpperCase(Locale.ROOT).contains(targetCode))
                                    || (content != null && content.toUpperCase(Locale.ROOT).contains(targetCode));

                            if (matchesCode && amountIn.compareTo(payment.getAmount()) >= 0) {
                                log.info("Detected matching bank transaction from SePay API for order {}", targetCode);
                                Instant now = Instant.now();
                                payment.setStatus(PaymentStatus.PAID);
                                payment.setPaidAt(now);
                                long txId = tx.path("id").asLong(0);
                                if (txId > 0) payment.setSepayTransactionId(txId);
                                payments.save(payment);

                                Enrollment enrollment = payment.getEnrollment();
                                if (enrollment != null) {
                                    enrollment.setStatus(EnrollmentStatus.ACTIVE);
                                    enrollment.setActivatedAt(now);
                                    enrollments.save(enrollment);
                                }
                                return true;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("SePay API query notice: {}", e.getMessage());
        }
        return false;
    }
}
