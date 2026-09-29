package com.resolvedesk.users.persistence;

import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(UserRole role);

    List<User> findByRoleAndActiveTrueOrderByFirstNameAscLastNameAsc(UserRole role);
}
