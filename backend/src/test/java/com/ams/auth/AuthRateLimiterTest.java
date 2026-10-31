package com.ams.auth;

import com.ams.auth.exception.RateLimitException;
import com.ams.auth.security.AuthRateLimiter;
import com.ams.auth.security.AuthRateLimitFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthRateLimiterTest {
    @Test void enforcesAtomicLimitsUnderConcurrentRequests() {
        var limiter = new AuthRateLimiter();
        var accepted = new AtomicInteger();
        IntStream.range(0, 100).parallel().forEach(i -> {
            try { limiter.check("same-account", 5, Duration.ofMinutes(1)); accepted.incrementAndGet(); }
            catch (RateLimitException expected) { }
        });
        assertThat(accepted.get()).isEqualTo(5);
    }

    @Test void windowExpiresAndActiveKeysAreNeverEvictedToBypassLimits() {
        Clock clock = mock(Clock.class); when(clock.millis()).thenReturn(0L);
        var limiter = new AuthRateLimiter(clock);
        limiter.check("a", 1, Duration.ofMinutes(1));
        assertThatThrownBy(() -> limiter.check("a", 1, Duration.ofMinutes(1))).isInstanceOf(RateLimitException.class);
        for (int i = 0; i < 9999; i++) limiter.check("key" + i, 1, Duration.ofMinutes(1));
        assertThatThrownBy(() -> limiter.check("overflow", 1, Duration.ofMinutes(1))).isInstanceOf(RateLimitException.class);
        when(clock.millis()).thenReturn(60001L);
        assertThatCode(() -> limiter.check("a", 1, Duration.ofMinutes(1))).doesNotThrowAnyException();
    }

    @Test void ipFilterReturns429AndIgnoresSpoofedForwardedHeaders() throws Exception {
        var filter = new AuthRateLimitFilter(new AuthRateLimiter());
        var passed = new AtomicInteger();
        for (int i = 0; i < 6; i++) {
            var request = new MockHttpServletRequest("POST", "/api/auth/forgot-password");
            request.setServletPath("/api/auth/forgot-password"); request.setRemoteAddr("127.0.0.1");
            request.addHeader("X-Forwarded-For", "spoofed-" + i);
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, (req, res) -> passed.incrementAndGet());
            if (i == 5) { assertThat(response.getStatus()).isEqualTo(429); assertThat(response.getHeader("Retry-After")).isNotBlank(); }
        }
        assertThat(passed.get()).isEqualTo(5);
    }
}
