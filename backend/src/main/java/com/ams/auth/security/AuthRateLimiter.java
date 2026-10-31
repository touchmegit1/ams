package com.ams.auth.security;

import com.ams.auth.exception.RateLimitException;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/** Single-instance guard; use a shared gateway/Redis limiter when scaling horizontally. */
@Component
public class AuthRateLimiter {
    private final Map<String, Bucket> buckets = new HashMap<>();
    private final Clock clock;
    public AuthRateLimiter() { this(Clock.systemUTC()); }
    public AuthRateLimiter(Clock clock) { this.clock = clock; }

    public synchronized void check(String key, int maximum, Duration window) {
        long now = clock.millis();
        Bucket bucket = buckets.get(key);
        if (bucket == null || now >= bucket.until) {
            buckets.entrySet().removeIf(entry -> now >= entry.getValue().until);
            // Bound memory without evicting active limits (which would let an attacker reset them).
            if (buckets.size() >= 10000) throw new RateLimitException(60);
            bucket = new Bucket(now + window.toMillis());
            buckets.put(key, bucket);
        }
        if (bucket.count >= maximum) throw new RateLimitException((bucket.until - now + 999) / 1000);
        bucket.count++;
    }

    private static class Bucket {
        final long until;
        int count;
        Bucket(long until) { this.until = until; }
    }
}
