package com.resolvedesk.tickets.application;

public class InactiveTeamException extends RuntimeException {
    public InactiveTeamException() {
        super("Tickets may be routed only to active teams.");
    }
}
