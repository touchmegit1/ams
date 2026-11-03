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
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SepayWebhookService {
    private final ObjectMapper mapper;
    private final PaymentRepository payments;
    private final EnrollmentRepository enrollments;
    private final PaymentReviewRepository reviews;
    private final SepayTransactionRepository transactions;
    @Value("${sepay.webhook-secret:}") private String secret;
    @Value("${sepay.account-number:VQRQAHKMG5868}") private String accountNumber;
    @Value("${sepay.va-id:va_0VW1TccGmHtasOd3ELHwMPTJ0rm}") private String vaId;
    @Value("${sepay.order-prefix:AMS}") private String orderPrefix;

    public SepayWebhookService(ObjectMapper mapper, PaymentRepository payments, EnrollmentRepository enrollments,
            PaymentReviewRepository reviews, SepayTransactionRepository transactions) {
        this.mapper = mapper; this.payments = payments; this.enrollments = enrollments;
        this.reviews = reviews; this.transactions = transactions;
    }

    public void verify(byte[] body, String timestamp, String signature) {
        verify(body, timestamp, signature, null);
    }

    public void verify(byte[] body, String timestamp, String signature, String authHeader) {
        if (secret == null || secret.isBlank()) return;
        if (authHeader != null && !authHeader.isBlank()) {
            if (authHeader.equalsIgnoreCase("Apikey " + secret) || authHeader.equalsIgnoreCase("Bearer " + secret)) {
                return;
            }
        }
        if (timestamp == null || signature == null) throw unauthorized();
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
        PaymentReview existingReview = reviews.findBySepayTransactionIdForUpdate(id).orElse(null);
        if (transactions.existsById(id) && (existingReview == null || !"UNKNOWN_ORDER".equals(existingReview.getReason()))) return;
        String code = paymentCode(json);
        if (existingReview != null && code.isBlank()) return;
        String account = json.path("accountNumber").asText("");
        String subAccount = json.path("subAccount").asText("");
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
            if (transactions.existsById(id) && existingReview == null) return;
            String expectedAccount = (this.accountNumber != null && !this.accountNumber.isBlank()) ? this.accountNumber : "VQRQAHKMG5868";
            String expectedVa = (this.vaId != null && !this.vaId.isBlank()) ? this.vaId : "va_0VW1TccGmHtasOd3ELHwMPTJ0rm";
            boolean accountMatches = account.equalsIgnoreCase(expectedAccount)
                    || account.equalsIgnoreCase(expectedVa)
                    || account.equalsIgnoreCase("VQRQAHKMG5868")
                    || subAccount.equalsIgnoreCase(expectedAccount)
                    || subAccount.equalsIgnoreCase(expectedVa)
                    || subAccount.equalsIgnoreCase("VQRQAHKMG5868")
                    || (payment.getAccountNumber() != null && (account.equalsIgnoreCase(payment.getAccountNumber()) || subAccount.equalsIgnoreCase(payment.getAccountNumber())));
            if (!accountMatches) reason = "WRONG_ACCOUNT";
            else if (payment.getAmount().compareTo(amount) != 0) reason = "WRONG_AMOUNT";
            else if (payment.getStatus() != PaymentStatus.PENDING || enrollment.getStatus() == EnrollmentStatus.ACTIVE) reason = "ORDER_NOT_PENDING";
            else if (!transferTime(json).isBefore(payment.getExpiresAt())
                    || transferTime(json).isBefore(payment.getCreatedAt().truncatedTo(ChronoUnit.SECONDS).minus(Duration.ofMinutes(10)))) reason = "LATE_PAYMENT";
            else {
                payment.setStatus(PaymentStatus.PAID);
                payment.setPaidAt(Instant.now());
                payment.setSepayTransactionId(id);
                enrollment.setStatus(EnrollmentStatus.ACTIVE);
                enrollment.setActivatedAt(Instant.now());
            }
        }
        if (existingReview == null) {
            SepayTransaction transaction = new SepayTransaction();
            transaction.setId(id);
            transactions.save(transaction);
        }
        if (reason != null) {
            PaymentReview review = existingReview == null ? new PaymentReview() : existingReview;
            review.setSepayTransactionId(id);
            review.setOrderCode(code);
            review.setAccountNumber(account);
            review.setAmount(amount);
            review.setReason(reason);
            reviews.save(review);
        } else if (existingReview != null) {
            existingReview.setOrderCode(code);
            existingReview.setStatus(ReviewStatus.CLOSED);
            existingReview.setNote("Tự xác nhận sau khi SePay gửi lại webhook đã ký.");
            existingReview.setClosedAt(Instant.now());
        }
    }

    private String paymentCode(JsonNode json) {
        String extracted = json.path("code").asText("").trim();
        if (!extracted.isBlank()) {
            String clean = extracted.toUpperCase(Locale.ROOT);
            if (payments.findByOrderCode(clean).isPresent()) return clean;
        }
        String content = json.path("content").asText("");
        if (content.isBlank()) return extracted.isBlank() ? "" : extracted.toUpperCase(Locale.ROOT);

        // 1. Check against all pending payment order codes directly
        List<Payment> pendingList = payments.findAllByStatus(PaymentStatus.PENDING);
        for (Payment p : pendingList) {
            if (p.getOrderCode() != null && !p.getOrderCode().isBlank()) {
                if (content.toUpperCase(Locale.ROOT).contains(p.getOrderCode().toUpperCase(Locale.ROOT))) {
                    return p.getOrderCode().toUpperCase(Locale.ROOT);
                }
            }
        }

        // 2. Direct match with any payment in db by extracted code
        if (!extracted.isBlank() && payments.findByOrderCode(extracted.toUpperCase(Locale.ROOT)).isPresent()) {
            return extracted.toUpperCase(Locale.ROOT);
        }

        // 3. Regex match candidate with prefix + alphanumeric
        String prefix = (orderPrefix != null && !orderPrefix.isBlank()) ? orderPrefix : "AMS";
        Pattern pattern = Pattern.compile("(?i)(?<![A-Za-z0-9])" + Pattern.quote(prefix)
                + "([A-Za-z0-9]{4,20})(?![A-Za-z0-9])");
        Matcher matcher = pattern.matcher(content);
        String code = "";
        while (matcher.find()) {
            String candidate = matcher.group().toUpperCase(Locale.ROOT);
            if (payments.findByOrderCode(candidate).isPresent()) {
                return candidate;
            }
            if (!code.isBlank() && !code.equals(candidate)) return "";
            code = candidate;
        }
        return !code.isBlank() ? code : extracted.toUpperCase(Locale.ROOT);
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
