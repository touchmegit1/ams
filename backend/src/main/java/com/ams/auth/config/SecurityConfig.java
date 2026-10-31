package com.ams.auth.config;

import com.ams.auth.security.JwtAuthenticationFilter;
import com.ams.auth.security.AuthRateLimitFilter;
import com.ams.auth.security.AuthRateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final AuthRateLimiter limiter;
    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Cho phép truy cập các API auth không cần login
                .requestMatchers(
                    "/api/auth/register",
                    "/api/auth/login",
                    "/api/auth/forgot-password",
                    "/api/auth/reset-password",
                    "/api/auth/reset-password/validate",
                    "/api/auth/google-login",
                    "/api/auth/verify-otp",
                    "/api/auth/resend-otp"
                ).permitAll()
                .requestMatchers("/h2-console/**", "/swagger-ui/**", "/v3/api-docs/**", "/actuator/**").denyAll()
                // Tất cả các request khác cần authenticate
                .anyRequest().authenticated()
            )
            .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, ex) -> {
                response.setStatus(401);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"message\":\"Phiên đăng nhập không hợp lệ hoặc đã hết hạn.\"}");
            }))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new AuthRateLimitFilter(limiter), JwtAuthenticationFilter.class)
            .headers(headers -> headers.frameOptions(frame -> frame.deny()));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        var pbkdf2 = new Pbkdf2PasswordEncoder("", 16, 600000,
                Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256);
        var encoder = new DelegatingPasswordEncoder("pbkdf2", Map.of("pbkdf2", pbkdf2));
        // Verify legacy BCrypt accounts and upgrade the hash after their next successful login.
        encoder.setDefaultPasswordEncoderForMatches(new BCryptPasswordEncoder());
        return encoder;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(frontendUrl.replaceAll("/+$", "")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
