package com.resolvedesk.tickets.application;

public class StaleTicketException extends RuntimeException {
    public StaleTicketException() {
        super("This ticket was modified by another user. Reload the ticket and try again.");
    }
}
