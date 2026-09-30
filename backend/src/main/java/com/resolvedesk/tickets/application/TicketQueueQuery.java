package com.resolvedesk.tickets.application;

import com.resolvedesk.tickets.domain.TicketPriority;
import com.resolvedesk.tickets.domain.TicketStatus;
import org.springframework.data.domain.Sort;

import java.util.Locale;
import java.util.Set;

public record TicketQueueQuery(
        TicketStatus status,
        TicketPriority priority,
        Long assignedAgentId,
        boolean unassigned,
        Long teamId,
        boolean unassignedTeam,
        boolean myTeams,
        String search,
        int page,
        int size,
        Sort sort
) {
    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of("createdAt", "updatedAt", "priority", "status", "title");

    public static TicketQueueQuery from(
            String status,
            String priority,
            String assignedAgentId,
            String unassigned,
            String teamId,
            String unassignedTeam,
            String myTeams,
            String search,
            String page,
            String size,
            String sort
    ) {
        boolean unassignedValue = parseBoolean(unassigned, "unassigned");
        Long assignedAgentIdValue = parseOptionalPositiveLong(assignedAgentId, "assignedAgentId");
        boolean unassignedTeamValue = parseBoolean(unassignedTeam, "unassignedTeam");
        Long teamIdValue = parseOptionalPositiveLong(teamId, "teamId");
        boolean myTeamsValue = parseBoolean(myTeams, "myTeams");
        if (unassignedValue && assignedAgentIdValue != null) {
            throw new InvalidTicketQueryException("assignedAgentId and unassigned=true cannot be used together.");
        }
        if (unassignedTeamValue && teamIdValue != null) {
            throw new InvalidTicketQueryException("teamId and unassignedTeam=true cannot be used together.");
        }
        if (myTeamsValue && teamIdValue != null) {
            throw new InvalidTicketQueryException("teamId and myTeams=true cannot be used together.");
        }
        if (myTeamsValue && unassignedTeamValue) {
            throw new InvalidTicketQueryException("unassignedTeam and myTeams=true cannot be used together.");
        }
        return new TicketQueueQuery(
                parseEnum(status, TicketStatus.class, "status"),
                parseEnum(priority, TicketPriority.class, "priority"),
                assignedAgentIdValue,
                unassignedValue,
                teamIdValue,
                unassignedTeamValue,
                myTeamsValue,
                normalizeOptional(search),
                parsePage(page),
                parseSize(size),
                parseSort(sort)
        );
    }

    private static int parsePage(String value) {
        int page = parseInteger(value, "page");
        if (page < 0) throw new InvalidTicketQueryException("page must be zero or greater.");
        return page;
    }

    private static int parseSize(String value) {
        int size = parseInteger(value, "size");
        if (size < 1 || size > 100) throw new InvalidTicketQueryException("size must be between 1 and 100.");
        return size;
    }

    private static int parseInteger(String value, String parameter) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw new InvalidTicketQueryException(parameter + " must be a number.");
        }
    }

    private static Long parseOptionalPositiveLong(String value, String parameter) {
        String normalized = normalizeOptional(value);
        if (normalized == null) return null;
        try {
            long parsed = Long.parseLong(normalized);
            if (parsed < 1) throw new InvalidTicketQueryException(parameter + " must be positive.");
            return parsed;
        } catch (NumberFormatException exception) {
            throw new InvalidTicketQueryException(parameter + " must be a number.");
        }
    }

    private static boolean parseBoolean(String value, String parameter) {
        String normalized = normalizeOptional(value);
        if (normalized == null) return false;
        if ("true".equalsIgnoreCase(normalized)) return true;
        if ("false".equalsIgnoreCase(normalized)) return false;
        throw new InvalidTicketQueryException(parameter + " must be true or false.");
    }

    private static <T extends Enum<T>> T parseEnum(String value, Class<T> enumType, String parameter) {
        String normalized = normalizeOptional(value);
        if (normalized == null) return null;
        try {
            return Enum.valueOf(enumType, normalized.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new InvalidTicketQueryException(parameter + " has an unsupported value.");
        }
    }

    private static Sort parseSort(String value) {
        String[] parts = value.split(",", -1);
        if (parts.length != 2 || !ALLOWED_SORT_PROPERTIES.contains(parts[0])) {
            throw new InvalidTicketQueryException("sort must use an allowed property and direction.");
        }
        try {
            return Sort.by(Sort.Direction.fromString(parts[1]), parts[0]);
        } catch (IllegalArgumentException exception) {
            throw new InvalidTicketQueryException("sort direction must be asc or desc.");
        }
    }

    private static String normalizeOptional(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
