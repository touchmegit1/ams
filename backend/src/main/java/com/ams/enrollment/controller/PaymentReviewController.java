package com.ams.enrollment.controller;

import com.ams.enrollment.entity.PaymentReview;
import com.ams.enrollment.entity.ReviewStatus;
import com.ams.enrollment.repository.PaymentReviewRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/admin/payment-reviews")
public class PaymentReviewController {
    private final PaymentReviewRepository reviews;
    public PaymentReviewController(PaymentReviewRepository reviews) { this.reviews = reviews; }
    @GetMapping
    public List<PaymentReview> list() { return reviews.findAllByStatusOrderByCreatedAtDesc(ReviewStatus.OPEN); }
    @PostMapping("/{id}/close")
    @Transactional
    public PaymentReview close(@PathVariable Long id, @RequestBody CloseRequest request) {
        PaymentReview review = reviews.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (request.note() == null || request.note().isBlank() || request.note().length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A note is required (max 1000 characters)");
        }
        review.setNote(request.note().trim());
        review.setStatus(ReviewStatus.CLOSED);
        review.setClosedAt(Instant.now());
        return review;
    }
    public record CloseRequest(String note) {}
}
