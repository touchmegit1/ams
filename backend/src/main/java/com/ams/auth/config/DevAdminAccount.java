package com.ams.auth.config;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** A disposable admin for the in-memory development database only. */
@Component
@Profile("dev")
@RequiredArgsConstructor
public class DevAdminAccount implements CommandLineRunner {
    private static final String EMAIL = "admin@gmail.com";
    private static final String PASSWORD = "Admin@123";
    private final UserRepository users;
    private final PasswordEncoder passwords;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @Override
    public void run(String... args) {
        if (!datasourceUrl.startsWith("jdbc:h2:mem:")) return;
        if (users.existsByEmail(EMAIL)) return;
        users.save(User.builder()
                .fullName("Quản trị viên mẫu")
                .email(EMAIL)
                .passwordHash(passwords.encode(PASSWORD))
                .role(User.Role.ADMIN)
                .isVerified(true)
                .isEnabled(true)
                .build());
    }
}
