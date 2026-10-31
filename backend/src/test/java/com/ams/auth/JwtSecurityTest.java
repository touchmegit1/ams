package com.ams.auth;

import com.ams.auth.security.JwtTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import java.util.Base64;
import java.util.Date;
import static org.assertj.core.api.Assertions.*;

class JwtSecurityTest {
    @Test void requiresProductionSecretAndLimitsLifetime() {
        var prod = new MockEnvironment(); prod.setActiveProfiles("prod", "dev");
        assertThatThrownBy(() -> new JwtTokenProvider("", 900000, prod)).isInstanceOf(IllegalStateException.class);
        var dev = new MockEnvironment(); dev.setActiveProfiles("dev");
        assertThatCode(() -> new JwtTokenProvider("", 900000, dev)).doesNotThrowAnyException();
        assertThatThrownBy(() -> new JwtTokenProvider("", 86400000, dev)).isInstanceOf(IllegalStateException.class);
    }

    @Test void rejectsExpiredForgedMissingVersionAndNonNumericSubjects() {
        var key = Jwts.SIG.HS256.key().build();
        String secret = Base64.getEncoder().encodeToString(key.getEncoded());
        var provider = new JwtTokenProvider(secret, 900000, new MockEnvironment());
        String valid = provider.generateToken(1, "test@example.com", "STUDENT", 2);
        assertThat(provider.validateToken(valid)).isTrue();
        assertThat(provider.getAuthVersion(valid)).isEqualTo(2);
        var other = new JwtTokenProvider(Base64.getEncoder().encodeToString(Jwts.SIG.HS256.key().build().getEncoded()), 900000, new MockEnvironment());
        assertThat(other.validateToken(valid)).isFalse();
        String expired = Jwts.builder().issuer("ams").subject("1").claim("ver", 0)
                .issuedAt(new Date(0)).expiration(new Date(1)).signWith(key).compact();
        assertThat(provider.validateToken(expired)).isFalse();
        String malformed = Jwts.builder().issuer("ams").subject("not-an-integer").claim("ver", 0)
                .issuedAt(new Date()).expiration(new Date(System.currentTimeMillis() + 60000)).signWith(key).compact();
        assertThat(provider.validateToken(malformed)).isFalse();
        String legacy = Jwts.builder().issuer("ams").subject("1")
                .issuedAt(new Date()).expiration(new Date(System.currentTimeMillis() + 60000)).signWith(key).compact();
        assertThat(provider.validateToken(legacy)).isFalse();
    }
}
