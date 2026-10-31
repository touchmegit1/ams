package com.ams.auth.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import java.net.URI;

@Component
@Profile("prod")
public class ProductionSecurityCheck {
    @Value("${app.frontend-url}") private String frontendUrl;
    @PostConstruct
    void validate() {
        if (!"https".equals(URI.create(frontendUrl).getScheme())) {
            throw new IllegalStateException("FRONTEND_URL phải dùng HTTPS trong production");
        }
    }
}
