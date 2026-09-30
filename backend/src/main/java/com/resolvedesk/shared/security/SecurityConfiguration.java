package com.resolvedesk.shared.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resolvedesk.auth.application.BootstrapAdminProperties;
import com.resolvedesk.auth.application.DatabaseUserDetailsService;
import com.resolvedesk.shared.api.ProblemResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.http.HttpMethod;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

import java.io.IOException;
import java.net.URI;
import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(BootstrapAdminProperties.class)
public class SecurityConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(DatabaseUserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider::authenticate;
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            SecurityContextRepository securityContextRepository,
            ObjectMapper objectMapper
    ) throws Exception {
        CookieCsrfTokenRepository csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepository.setCookiePath("/");

        return http
                .securityContext(context -> context.securityContextRepository(securityContextRepository)
                        .requireExplicitSave(true))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .csrf(csrf -> csrf.csrfTokenRepository(csrfRepository))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/csrf", "/api-docs/**", "/swagger-ui/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/tickets").hasRole("CUSTOMER")
                        .requestMatchers(HttpMethod.GET, "/api/v1/users/me/teams").hasAnyRole("AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/tickets", "/api/v1/tickets/*", "/api/v1/tickets/*/history").hasAnyRole("CUSTOMER", "AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/tickets/*/comments").hasAnyRole("CUSTOMER", "AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/tickets/*/comments").hasAnyRole("CUSTOMER", "AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/agents").hasAnyRole("AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/teams/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/teams").hasAnyRole("AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/teams").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/teams/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/teams/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/teams/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/users").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*/role", "/api/v1/users/*/active").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/tickets/*/assignee").hasAnyRole("AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/tickets/*/team").hasAnyRole("AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/tickets/*/status").hasAnyRole("CUSTOMER", "AGENT", "ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/tickets/*/priority").hasAnyRole("AGENT", "ADMIN")
                        .anyRequest().authenticated())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> writeProblem(
                                objectMapper, request, response, HttpStatus.UNAUTHORIZED,
                                "Authentication required", "Authentication is required to access this resource.", "AUTHENTICATION_REQUIRED"))
                        .accessDeniedHandler(accessDeniedHandler(objectMapper)))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .build();
    }

    private AccessDeniedHandler accessDeniedHandler(ObjectMapper objectMapper) {
        return (request, response, exception) -> writeProblem(
                objectMapper, request, response, HttpStatus.FORBIDDEN,
                "Access denied", "You are not permitted to perform this action.", "ACCESS_DENIED");
    }

    private void writeProblem(
            ObjectMapper objectMapper,
            HttpServletRequest request,
            HttpServletResponse response,
            HttpStatus status,
            String title,
            String detail,
            String code
    ) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), new ProblemResponse(
                URI.create("/problems/" + code.toLowerCase().replace('_', '-')),
                title,
                status.value(),
                detail,
                URI.create(request.getRequestURI()),
                code,
                Map.of()
        ));
    }
}
