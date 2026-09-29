package com.resolvedesk.tickets.application;

public class TicketNotFoundException extends RuntimeException {
    public TicketNotFoundException() {
        super("The requested ticket could not be found.");
    }
}
