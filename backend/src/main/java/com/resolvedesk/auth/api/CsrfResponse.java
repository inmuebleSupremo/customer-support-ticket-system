package com.resolvedesk.auth.api;

public record CsrfResponse(String headerName, String parameterName, String token) {
}
