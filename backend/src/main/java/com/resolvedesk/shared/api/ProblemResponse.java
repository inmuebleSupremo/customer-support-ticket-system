package com.resolvedesk.shared.api;

import java.net.URI;
import java.util.Map;

/**
 * Foundation DTO for the API's Problem Details-style error contract.
 * Business-specific error codes and mappings are added with their features.
 */
public record ProblemResponse(
        URI type,
        String title,
        int status,
        String detail,
        URI instance,
        String code,
        Map<String, String> fieldErrors
) {
}
