package com.resolvedesk.auth.application;

import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BootstrapAdminInitializerTests {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @Test
    void createsTheFirstAdminOnlyFromCompleteEnvironmentConfiguration() throws Exception {
        BootstrapAdminProperties properties = configuredProperties();
        when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("ExamplePassword123!")).thenReturn("hashed-password");

        new BootstrapAdminInitializer(properties, userRepository, passwordEncoder).run(new DefaultApplicationArguments());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedAdmin = userCaptor.getValue();
        assertThat(savedAdmin.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(savedAdmin.getEmail()).isEqualTo("admin@example.com");
        assertThat(savedAdmin.getPasswordHash()).isEqualTo("hashed-password");
    }

    @Test
    void doesNothingWhenNoBootstrapCredentialsAreConfigured() throws Exception {
        new BootstrapAdminInitializer(new BootstrapAdminProperties(), userRepository, passwordEncoder)
                .run(new DefaultApplicationArguments());

        verifyNoInteractions(userRepository, passwordEncoder);
    }

    @Test
    void rejectsAnIncompleteBootstrapConfiguration() {
        BootstrapAdminProperties properties = new BootstrapAdminProperties();
        properties.setEmail("admin@example.com");

        assertThrows(IllegalStateException.class,
                () -> new BootstrapAdminInitializer(properties, userRepository, passwordEncoder)
                        .run(new DefaultApplicationArguments()));
        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private BootstrapAdminProperties configuredProperties() {
        BootstrapAdminProperties properties = new BootstrapAdminProperties();
        properties.setEmail("Admin@Example.com");
        properties.setPassword("ExamplePassword123!");
        properties.setFirstName("Resolve");
        properties.setLastName("Desk");
        return properties;
    }
}
