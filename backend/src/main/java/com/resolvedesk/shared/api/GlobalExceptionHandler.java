package com.resolvedesk.shared.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.Map;

/**
 * Prevents unexpected exceptions from exposing implementation details.
 * Feature-specific exception mappings are intentionally deferred.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemResponse> handleUnexpectedException(HttpServletRequest request) {
        ProblemResponse response = new ProblemResponse(
                URI.create("/problems/internal-error"),
                "Internal server error",
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "An unexpected error occurred.",
                URI.create(request.getRequestURI()),
                "INTERNAL_ERROR",
                Map.of()
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
