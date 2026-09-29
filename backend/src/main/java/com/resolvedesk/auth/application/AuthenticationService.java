package com.resolvedesk.auth.application;

import com.resolvedesk.auth.api.LoginRequest;
import com.resolvedesk.auth.api.LoginResponse;
import com.resolvedesk.auth.api.RegisterRequest;
import com.resolvedesk.users.api.CurrentUserResponse;
import com.resolvedesk.users.application.UserResponseMapper;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class AuthenticationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthenticationService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public CurrentUserResponse registerCustomer(RegisterRequest request) {
        String email = normalizeEmail(request.email());

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException();
        }

        User customer = User.create(
                email,
                passwordEncoder.encode(request.password()),
                request.firstName().trim(),
                request.lastName().trim(),
                UserRole.CUSTOMER
        );

        try {
            return UserResponseMapper.toCurrentUser(userRepository.saveAndFlush(customer));
        } catch (DataIntegrityViolationException exception) {
            throw new EmailAlreadyExistsException();
        }
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public LoginResponse toLoginResponse(User user) {
        return new LoginResponse(new LoginResponse.LoginUserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.isActive()
        ));
    }
}
