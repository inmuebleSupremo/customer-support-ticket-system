package com.resolvedesk.shared.api;

import com.resolvedesk.auth.application.EmailAlreadyExistsException;
import com.resolvedesk.tickets.application.TicketNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemResponse> handleValidationException(MethodArgumentNotValidException exception, HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", "One or more request fields are invalid.",
                "VALIDATION_ERROR", request, fieldErrors);
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    ResponseEntity<ProblemResponse> handleDuplicateEmail(EmailAlreadyExistsException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "Email already exists", exception.getMessage(), "EMAIL_ALREADY_EXISTS", request, Map.of());
    }

    @ExceptionHandler(TicketNotFoundException.class)
    ResponseEntity<ProblemResponse> handleTicketNotFound(TicketNotFoundException exception, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "Ticket not found", exception.getMessage(), "RESOURCE_NOT_FOUND", request, Map.of());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemResponse> handleUnreadableRequest(HttpMessageNotReadableException exception, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", "The request body is invalid.",
                "VALIDATION_ERROR", request, Map.of());
    }

    @ExceptionHandler(DisabledException.class)
    ResponseEntity<ProblemResponse> handleInactiveAccount(DisabledException exception, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "Account inactive", "This account is inactive.", "ACCOUNT_INACTIVE", request, Map.of());
    }

    @ExceptionHandler({BadCredentialsException.class, AuthenticationServiceException.class})
    ResponseEntity<ProblemResponse> handleInvalidCredentials(AuthenticationException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, "Invalid credentials", "Invalid email or password.", "INVALID_CREDENTIALS", request, Map.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemResponse> handleUnexpectedException(HttpServletRequest request) {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", "An unexpected error occurred.",
                "INTERNAL_ERROR", request, Map.of());
    }

    private ResponseEntity<ProblemResponse> problem(
            HttpStatus status,
            String title,
            String detail,
            String code,
            HttpServletRequest request,
            Map<String, String> fieldErrors
    ) {
        ProblemResponse response = new ProblemResponse(
                URI.create("/problems/" + code.toLowerCase().replace('_', '-')),
                title,
                status.value(),
                detail,
                URI.create(request.getRequestURI()),
                code,
                fieldErrors
        );
        return ResponseEntity.status(status).body(response);
    }
}
