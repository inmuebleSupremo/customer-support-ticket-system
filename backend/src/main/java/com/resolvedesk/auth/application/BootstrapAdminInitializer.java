package com.resolvedesk.auth.application;

import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BootstrapAdminInitializer implements ApplicationRunner {

    private final BootstrapAdminProperties properties;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public BootstrapAdminInitializer(
            BootstrapAdminProperties properties,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.properties = properties;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.isConfigured()) {
            return;
        }

        validateConfiguration();

        if (userRepository.countByRole(UserRole.ADMIN) > 0) {
            return;
        }

        String email = AuthenticationService.normalizeEmail(properties.getEmail());
        userRepository.findByEmail(email).ifPresent(existingUser -> {
            throw new IllegalStateException("Bootstrap administrator email is already assigned to a non-administrator account.");
        });

        User administrator = User.create(
                email,
                passwordEncoder.encode(properties.getPassword()),
                properties.getFirstName().trim(),
                properties.getLastName().trim(),
                UserRole.ADMIN
        );
        userRepository.save(administrator);
    }

    private void validateConfiguration() {
        if (properties.getEmail().isBlank() || properties.getPassword().isBlank()
                || properties.getFirstName().isBlank() || properties.getLastName().isBlank()) {
            throw new IllegalStateException("Bootstrap administrator configuration must include email, password, first name, and last name.");
        }
        if (!properties.getEmail().contains("@") || properties.getPassword().length() < 12) {
            throw new IllegalStateException("Bootstrap administrator configuration is invalid.");
        }
    }
}
