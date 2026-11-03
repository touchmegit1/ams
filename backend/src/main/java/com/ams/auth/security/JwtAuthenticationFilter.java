package com.ams.auth.security;

import com.ams.auth.entity.User;
import com.ams.auth.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Filter chặn mọi request, kiểm tra JWT trong header Authorization.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = extractToken(request);

        if (StringUtils.hasText(token) && tokenProvider.validateToken(token)) {
            Integer userId = tokenProvider.getUserIdFromToken(token);
            User user = userRepository.findById(userId).orElse(null);
            if (user != null && Boolean.TRUE.equals(user.getIsVerified()) && Boolean.TRUE.equals(user.getIsEnabled())
                    && Integer.valueOf(user.getAuthVersion()).equals(tokenProvider.getAuthVersion(token))) {
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
                var authentication = new UsernamePasswordAuthenticationToken(userId, null, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else {
                request.setAttribute("ams.auth.failure", user == null ? "Tài khoản trong phiên đăng nhập không còn tồn tại." :
                    !Boolean.TRUE.equals(user.getIsEnabled()) ? "Tài khoản đã bị vô hiệu hóa." :
                    !Boolean.TRUE.equals(user.getIsVerified()) ? "Tài khoản chưa xác minh." : "Phiên đăng nhập đã bị thu hồi sau khi thông tin bảo mật thay đổi.");
            }
        } else if (StringUtils.hasText(request.getHeader("Authorization"))) {
            request.setAttribute("ams.auth.failure", tokenProvider.validationMessage(token));
        } else if (request.getRequestURI().startsWith("/api/student/assignments/")) {
            request.setAttribute("ams.auth.failure", "Request bài tập thiếu Bearer token xác thực.");
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
