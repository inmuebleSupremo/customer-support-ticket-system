package com.resolvedesk.users.persistence;

import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(UserRole role);

    long countByRoleAndActiveTrue(UserRole role);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<User> findByRoleAndActiveTrue(UserRole role);

    List<User> findByRoleAndActiveTrueOrderByFirstNameAscLastNameAsc(UserRole role);
}
