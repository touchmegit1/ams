package com.ams.auth.config;

import com.ams.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LegacyOtpCleanup implements ApplicationRunner {
    private final UserRepository users;
    @Override public void run(ApplicationArguments args) { users.removeLegacyPlaintextOtps(); }
}
