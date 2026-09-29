package com.resolvedesk.tickets.application;

public class TicketClosedException extends RuntimeException {
    public TicketClosedException() {
        super("This ticket is closed and cannot be changed.");
    }
}
