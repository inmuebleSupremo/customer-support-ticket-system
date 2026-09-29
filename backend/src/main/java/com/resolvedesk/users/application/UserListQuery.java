package com.resolvedesk.users.application;

import com.resolvedesk.users.domain.UserRole;
import org.springframework.data.domain.Sort;

import java.util.Locale;
import java.util.Set;

public record UserListQuery(UserRole role, Boolean active, String search, int page, int size, Sort sort) {
    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of("createdAt", "firstName", "lastName", "email", "role", "active");

    public static UserListQuery from(String role, String active, String search, String page, String size, String sort) {
        return new UserListQuery(
                parseEnum(role),
                parseBoolean(active),
                normalizeOptional(search),
                parsePage(page),
                parseSize(size),
                parseSort(sort)
        );
    }

    private static UserRole parseEnum(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null) return null;
        try {
            return UserRole.valueOf(normalized.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new InvalidUserQueryException("role has an unsupported value.");
        }
    }

    private static Boolean parseBoolean(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null) return null;
        if ("true".equalsIgnoreCase(normalized)) return true;
        if ("false".equalsIgnoreCase(normalized)) return false;
        throw new InvalidUserQueryException("active must be true or false.");
    }

    private static int parsePage(String value) {
        int parsed = parseInteger(value, "page");
        if (parsed < 0) throw new InvalidUserQueryException("page must be zero or greater.");
        return parsed;
    }

    private static int parseSize(String value) {
        int parsed = parseInteger(value, "size");
        if (parsed < 1 || parsed > 100) throw new InvalidUserQueryException("size must be between 1 and 100.");
        return parsed;
    }

    private static int parseInteger(String value, String name) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw new InvalidUserQueryException(name + " must be a number.");
        }
    }

    private static Sort parseSort(String value) {
        String[] parts = value.split(",", -1);
        if (parts.length != 2 || !ALLOWED_SORT_PROPERTIES.contains(parts[0])) {
            throw new InvalidUserQueryException("sort must use an allowed property and direction.");
        }
        try {
            return Sort.by(Sort.Direction.fromString(parts[1]), parts[0]);
        } catch (IllegalArgumentException exception) {
            throw new InvalidUserQueryException("sort direction must be asc or desc.");
        }
    }

    private static String normalizeOptional(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
