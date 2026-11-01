package com.ams.auth;

import com.ams.auth.validation.StrongPasswordValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTest {
    @Test void matchesSharedFrontendVectorsAndUnicodeLengthBoundaries() throws Exception {
        try (var stream = getClass().getResourceAsStream("/password-policy-cases.json")) {
            for (var entry : new ObjectMapper().readTree(stream)) {
                assertThat(StrongPasswordValidator.isStrong(entry.get("value").asText()))
                        .isEqualTo(entry.get("valid").asBoolean());
            }
        }
        assertThat(StrongPasswordValidator.isStrong("Áa1!" + "ệ".repeat(60))).isTrue();
        assertThat(StrongPasswordValidator.isStrong("Áa1!" + "ệ".repeat(61))).isFalse();
        assertThat(StrongPasswordValidator.isStrong(null)).isFalse();
    }
}
