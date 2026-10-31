package com.ams.auth.controller;

import com.ams.auth.entity.User;
import com.ams.auth.exception.AuthBusinessException;
import com.ams.auth.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/admin/accounts")
@RequiredArgsConstructor
public class AdminController {
    private final UserRepository users;

    public record Account(Integer userId, String fullName, String email, String role,
                          boolean verified, boolean enabled, LocalDateTime createdAt) {
        static Account from(User user) {
            return new Account(user.getUserId(), user.getFullName(), user.getEmail(),
                    user.getRole().name(), Boolean.TRUE.equals(user.getIsVerified()),
                    Boolean.TRUE.equals(user.getIsEnabled()), user.getCreatedAt());
        }
    }
    public record UpdateAccount(@NotNull User.Role role, @NotNull Boolean enabled) {}

    @GetMapping
    @Transactional(readOnly = true)
    public Page<Account> list(@RequestParam(defaultValue = "") String search,
                              @RequestParam(defaultValue = "ALL") String role,
                              @RequestParam(defaultValue = "0") int page) {
        if (page < 0) throw new AuthBusinessException("Trang không hợp lệ.");
        User.Role selected = "ALL".equals(role) ? null : parseRole(role);
        return users.searchAccounts(search.trim(), selected,
                PageRequest.of(page, 10, Sort.by(Sort.Direction.DESC, "createdAt", "userId"))).map(Account::from);
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
        return Account.from(users.save(user));
    }

    private User.Role parseRole(String value) {
        try { return User.Role.valueOf(value); }
        catch (IllegalArgumentException ex) { throw new AuthBusinessException("Vai trò không hợp lệ."); }
    }
}
