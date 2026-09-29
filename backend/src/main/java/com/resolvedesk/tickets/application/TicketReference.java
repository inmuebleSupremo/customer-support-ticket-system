package com.resolvedesk.tickets.application;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TicketReference {
    private static final String PREFIX = "SUP-";
    private static final Pattern FORMAT = Pattern.compile("SUP-([1-9]\\d*)", Pattern.CASE_INSENSITIVE);

    private TicketReference() {
    }

    public static String format(long id) {
        if (id < 1) {
            throw new IllegalArgumentException("Ticket IDs must be positive.");
        }
        return PREFIX + id;
    }

    public static Optional<Long> parse(String value) {
        if (value == null) {
            return Optional.empty();
        }
        Matcher matcher = FORMAT.matcher(value.trim());
        if (!matcher.matches()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.parseLong(matcher.group(1)));
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }
}
