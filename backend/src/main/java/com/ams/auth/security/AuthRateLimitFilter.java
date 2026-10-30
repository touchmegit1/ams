package com.ams.auth.security;

import com.ams.auth.exception.RateLimitException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

@RequiredArgsConstructor
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private final AuthRateLimiter limiter;
    private static final Map<String, Integer> LIMITS = Map.of(
            "/api/auth/register", 5, "/api/auth/login", 20,
            "/api/auth/google-login", 20, "/api/auth/verify-otp", 20,
            "/api/auth/resend-otp", 5, "/api/auth/forgot-password", 5,
            "/api/auth/reset-password", 10, "/api/auth/reset-password/validate", 30);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        Integer max = LIMITS.get(request.getServletPath());
        try {
            if (max != null && "POST".equals(request.getMethod())) {
                // Do not trust attacker-supplied X-Forwarded-For headers.
                limiter.check("ip:" + request.getRemoteAddr() + ":" + request.getServletPath(), max, Duration.ofMinutes(5));
            }
        } catch (RateLimitException ex) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(ex.getRetryAfter()));
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"Bạn đã thử quá nhiều lần. Vui lòng đợi trước khi thử lại.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
