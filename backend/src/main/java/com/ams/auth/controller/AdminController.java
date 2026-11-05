package com.ams.auth.controller;

import com.ams.auth.entity.User;
import com.ams.auth.exception.AuthBusinessException;
import com.ams.auth.repository.UserRepository;
import com.ams.coursemgmt.repository.CourseRepository;
import com.ams.enrollment.repository.EnrollmentRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/accounts")
@RequiredArgsConstructor
public class AdminController {
    private final UserRepository users;
    private final CourseRepository courses;
    private final EnrollmentRepository enrollments;
    private final PasswordEncoder passwordEncoder;

    public record Account(
            Integer userId,
            String fullName,
            String email,
            String role,
            boolean verified,
            boolean enabled,
            String userCode,
            String department,
            long courseCount,
            LocalDateTime createdAt
    ) {}

    public record UpdateAccount(@NotNull User.Role role, @NotNull Boolean enabled) {}

    public record CreateAccountRequest(
            @NotBlank String fullName,
            @NotBlank @Email String email,
            @NotBlank String password,
            @NotNull User.Role role,
            String department
    ) {}

    private Account toAccount(User user) {
        String userCode;
        String department = user.getDepartment();
        long count = 0;
        int id = user.getUserId() != null ? user.getUserId() : 1;

        if (user.getRole() == User.Role.TEACHER) {
            userCode = String.format("GV%03d", id % 1000);
            count = courses.countByTeacher_UserId(id);
        } else if (user.getRole() == User.Role.STUDENT) {
            userCode = String.format("SV2021%04d", (id * 137) % 10000);
            count = enrollments.countByStudent_UserId(id);
        } else {
            userCode = String.format("AD%03d", id % 1000);
            count = 0;
        }

        return new Account(
                user.getUserId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().name(),
                Boolean.TRUE.equals(user.getIsVerified()),
                Boolean.TRUE.equals(user.getIsEnabled()),
                userCode,
                department,
                count,
                user.getCreatedAt()
        );
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Page<Account> list(@RequestParam(defaultValue = "") String search,
                              @RequestParam(defaultValue = "ALL") String role,
                              @RequestParam(defaultValue = "ALL") String status,
                              @RequestParam(defaultValue = "") String department,
                              @RequestParam(defaultValue = "0") int page) {
        if (page < 0) throw new AuthBusinessException("Trang không hợp lệ.");
        User.Role selected = "ALL".equals(role) ? null : parseRole(role);
        Boolean enabled = switch (status) {
            case "ALL" -> null;
            case "ENABLED" -> true;
            case "DISABLED" -> false;
            default -> throw new AuthBusinessException("Trạng thái không hợp lệ.");
        };
        return users.searchAccounts(search.trim(), selected, enabled,
                department.isBlank() ? null : department.trim(),
                PageRequest.of(page, 10, Sort.by(Sort.Direction.DESC, "createdAt", "userId")))
                .map(this::toAccount);
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public Map<String, Object> getStats() {
        List<User> all = users.findAll();
        long totalAccounts = all.size();
        long teacherCount = all.stream().filter(u -> u.getRole() == User.Role.TEACHER).count();
        long studentCount = all.stream().filter(u -> u.getRole() == User.Role.STUDENT).count();
        long adminCount = all.stream().filter(u -> u.getRole() == User.Role.ADMIN).count();
        long blockedOrPending = all.stream().filter(u -> !Boolean.TRUE.equals(u.getIsEnabled()) || !Boolean.TRUE.equals(u.getIsVerified())).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalAccounts", totalAccounts);
        stats.put("teacherCount", teacherCount);
        stats.put("studentCount", studentCount);
        stats.put("adminCount", adminCount);
        stats.put("blockedOrPendingCount", blockedOrPending);
        return stats;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Account> create(@Valid @RequestBody CreateAccountRequest req) {
        if (users.existsByEmail(req.email().trim().toLowerCase())) {
            throw new AuthBusinessException("Email đã được sử dụng trong hệ thống.");
        }
        User user = User.builder()
                .fullName(req.fullName().trim())
                .email(req.email().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(req.role())
                .department(req.department() == null || req.department().isBlank() ? null : req.department().trim())
                .isEnabled(true)
                .isVerified(true)
                .build();
        User saved = users.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(toAccount(saved));
    }

    @PatchMapping("/{id}")
    @Transactional
    public Account update(@PathVariable Integer id, @Valid @RequestBody UpdateAccount request,
                          Authentication authentication) {
        User user = users.findByIdForUpdate(id)
                .orElseThrow(() -> new AuthBusinessException("Không tìm thấy tài khoản."));
        if (id.equals(authentication.getPrincipal()))
            throw new AuthBusinessException("Không thể thay đổi quyền hoặc khóa tài khoản của chính mình.");
        if (user.getRole() != request.role() || !request.enabled().equals(user.getIsEnabled())) {
            user.setRole(request.role());
            user.setIsEnabled(request.enabled());
            user.setAuthVersion(user.getAuthVersion() + 1);
        }
        return toAccount(users.save(user));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Integer id, Authentication authentication) {
        if (id.equals(authentication.getPrincipal())) {
            throw new AuthBusinessException("Không thể xóa tài khoản của chính mình.");
        }
        User user = users.findById(id)
                .orElseThrow(() -> new AuthBusinessException("Không tìm thấy tài khoản."));
        users.delete(user);
        return ResponseEntity.noContent().build();
    }

    private User.Role parseRole(String value) {
        try { return User.Role.valueOf(value); }
        catch (IllegalArgumentException ex) { throw new AuthBusinessException("Vai trò không hợp lệ."); }
    }
}
