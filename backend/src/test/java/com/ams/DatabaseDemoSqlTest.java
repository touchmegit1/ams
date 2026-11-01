package com.ams;

import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.assertj.core.api.Assertions.assertThat;

class DatabaseDemoSqlTest {
    @Test void demoScriptCreatesTablesAndSampleData() throws Exception {
        String sql = Files.readString(Path.of("db", "ams_demo.sql"));
        sql = sql.replaceAll("(?m)^--.*$", "");
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:demo_sql;MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            for (String statement : sql.split(";")) {
                String trimmed = statement.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("DROP DATABASE")
                        || trimmed.startsWith("CREATE DATABASE") || trimmed.startsWith("USE ams_db")) continue;
                try (var command = connection.createStatement()) { command.execute(trimmed); }
            }
            try (var command = connection.createStatement()) {
                var accounts = command.executeQuery("SELECT COUNT(*) FROM users WHERE is_verified = TRUE");
                assertThat(accounts.next()).isTrue(); assertThat(accounts.getInt(1)).isEqualTo(3);
                var courses = command.executeQuery("SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED'");
                assertThat(courses.next()).isTrue(); assertThat(courses.getInt(1)).isEqualTo(2);
                var enrollments = command.executeQuery("SELECT COUNT(*) FROM course_enrollments");
                assertThat(enrollments.next()).isTrue(); assertThat(enrollments.getInt(1)).isZero();
                var passwords = command.executeQuery("SELECT password_hash FROM users");
                var encoder = new BCryptPasswordEncoder();
                int checked = 0;
                while (passwords.next()) { assertThat(encoder.matches("Admin@123", passwords.getString(1))).isTrue(); checked++; }
                assertThat(checked).isEqualTo(3);
            }
        }
    }
}
