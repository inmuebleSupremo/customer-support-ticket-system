package com.resolvedesk.auth.application;

import com.resolvedesk.auth.application.AuthenticationService;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.persistence.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public DatabaseUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(AuthenticationService.normalizeEmail(username))
                .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials."));
        return new AuthenticatedUser(user);
    }
}
