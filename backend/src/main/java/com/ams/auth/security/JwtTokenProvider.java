package com.ams.auth.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * Tạo và xác thực JWT token.
 */
@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${jwt.secret:}") String secret,
            @Value("${jwt.expiration-ms:900000}") long expirationMs,
            Environment environment) {
        if (secret.isBlank() && (environment.acceptsProfiles(Profiles.of("prod")) || !environment.acceptsProfiles(Profiles.of("dev")))) {
            throw new IllegalStateException("JWT_SECRET phải được cấu hình ngoài môi trường dev");
        }
        if (expirationMs <= 0 || expirationMs > 3600000) throw new IllegalStateException("JWT_EXPIRATION phải nằm trong 1–3600000 ms");
        this.key = secret.isBlank() ? Jwts.SIG.HS256.key().build() : Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.expirationMs = expirationMs;
    }

    /** Tạo JWT từ userId và role */
    public String generateToken(Integer userId, String email, String role, int authVersion) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim("role", role)
                .claim("ver", authVersion)
                .issuer("ams")
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    /** Lấy userId từ token */
    public Integer getUserIdFromToken(String token) {
        Claims claims = parseClaims(token);
        return Integer.parseInt(claims.getSubject());
    }

    /** Lấy role từ token */
    public String getRoleFromToken(String token) {
        return parseClaims(token).get("role", String.class);
    }

    public Integer getAuthVersion(String token) { return parseClaims(token).get("ver", Integer.class); }

    /** Validate token — trả true nếu hợp lệ */
    public boolean validateToken(String token) {
        try {
            Claims claims = parseClaims(token);
            return Integer.parseInt(claims.getSubject()) > 0 && claims.get("ver", Integer.class) != null
                    && claims.getExpiration() != null && claims.getIssuedAt() != null;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer("ams")
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
