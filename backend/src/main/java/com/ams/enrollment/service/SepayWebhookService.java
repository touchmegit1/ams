package com.ams.enrollment.service;

import com.ams.enrollment.entity.*;
import com.ams.enrollment.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Service
public class SepayWebhookService {
    private final ObjectMapper mapper;
    private final PaymentRepository payments;
    private final EnrollmentRepository enrollments;
    private final PaymentReviewRepository reviews;
    private final SepayTransactionRepository transactions;
    @Value("${sepay.webhook-secret:}") private String secret;
    @Value("${sepay.account-number:}") private String accountNumber;

    public SepayWebhookService(ObjectMapper mapper, PaymentRepository payments, EnrollmentRepository enrollments,
            PaymentReviewRepository reviews, SepayTransactionRepository transactions) {
        this.mapper = mapper; this.payments = payments; this.enrollments = enrollments;
        this.reviews = reviews; this.transactions = transactions;
    }

    public void verify(byte[] body, String timestamp, String signature) {
        if (secret.isBlank() || timestamp == null || signature == null) throw unauthorized();
        try {
            long seconds = Long.parseLong(timestamp);
            if (Math.abs(Instant.now().getEpochSecond() - seconds) > 300) throw unauthorized();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
            String expected = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
            if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), signature.getBytes(StandardCharsets.US_ASCII))) {
                throw unauthorized();
            }
        } catch (ResponseStatusException error) { throw error; }
        catch (Exception error) { throw unauthorized(); }
    }

    @Transactional
    public void process(byte[] body) {
        JsonNode json;
        try { json = mapper.readTree(body); }
        catch (Exception error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid JSON"); }
        long id = json.path("id").asLong(0);
        if (id <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing transaction id");
        if (transactions.existsById(id)) return;
        String code = json.path("code").asText("");
        String account = json.path("accountNumber").asText("");
        String direction = json.path("transferType").asText("");
        BigDecimal amount;
        try { amount = new BigDecimal(json.path("transferAmount").asText()); }
        catch (Exception error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid amount"); }
        Payment payment = payments.findByOrderCode(code).orElse(null);
        String reason = null;
        if (!"in".equalsIgnoreCase(direction)) reason = "NOT_INCOMING";
        else if (payment == null) reason = "UNKNOWN_ORDER";
        else {
            Enrollment enrollment = enrollments.findWithLockById(payment.getEnrollment().getId()).orElseThrow();
            if (transactions.existsById(id)) return;
            if (!account.equals(accountNumber) || !account.equals(payment.getAccountNumber())) reason = "WRONG_ACCOUNT";
            else if (payment.getAmount().compareTo(amount) != 0) reason = "WRONG_AMOUNT";
            else if (payment.getStatus() != PaymentStatus.PENDING || enrollment.getStatus() == EnrollmentStatus.ACTIVE) reason = "ORDER_NOT_PENDING";
            else if (!transferTime(json).isBefore(payment.getExpiresAt())
                    || transferTime(json).isBefore(payment.getCreatedAt().truncatedTo(ChronoUnit.SECONDS))) reason = "LATE_PAYMENT";
            else {
                payment.setStatus(PaymentStatus.PAID);
                payment.setPaidAt(Instant.now());
                payment.setSepayTransactionId(id);
                enrollment.setStatus(EnrollmentStatus.ACTIVE);
                enrollment.setActivatedAt(Instant.now());
            }
        }
        SepayTransaction transaction = new SepayTransaction();
        transaction.setId(id);
        transactions.save(transaction);
        if (reason != null) {
            PaymentReview review = new PaymentReview();
            review.setSepayTransactionId(id);
            review.setOrderCode(code);
            review.setAccountNumber(account);
            review.setAmount(amount);
            review.setReason(reason);
            reviews.save(review);
        }
    }

    private ResponseStatusException unauthorized() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook signature"); }
    private Instant transferTime(JsonNode json) {
        try {
            return LocalDateTime.parse(json.path("transactionDate").asText(),
                    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                    .atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid transaction date");
        }
    }
}
