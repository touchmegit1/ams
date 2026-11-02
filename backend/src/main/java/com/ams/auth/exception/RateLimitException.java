package com.ams.auth.exception;

public class RateLimitException extends RuntimeException {
    private final long retryAfter;
    public RateLimitException(long retryAfter) {
        super("Bạn đã thử quá nhiều lần. Vui lòng đợi trước khi thử lại.");
        this.retryAfter = Math.max(1, retryAfter);
    }
    public long getRetryAfter() { return retryAfter; }
}
