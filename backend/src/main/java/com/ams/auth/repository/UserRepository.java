package com.ams.auth.repository;

import com.ams.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    @Query("select u from User u where (:role is null or u.role = :role) and (lower(u.fullName) like lower(concat('%', :search, '%')) or lower(u.email) like lower(concat('%', :search, '%')))")
    Page<User> searchAccounts(@Param("search") String search, @Param("role") User.Role role, Pageable pageable);

    @Modifying
    @Transactional
    @Query("update User u set u.otpCode = null where u.otpCode is not null")
    void removeLegacyPlaintextOtps();

    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmail(@Param("email") String email);

    Optional<User> findByGoogleId(String googleId);

    @Query("select (count(u) > 0) from User u where lower(u.email) = lower(:email)")
    boolean existsByEmail(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.userId = :id")
    Optional<User> findByIdForUpdate(@Param("id") Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmailForPasswordReset(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.passwordResetTokenHash = :hash")
    Optional<User> findByPasswordResetTokenHash(@Param("hash") String hash);
}
