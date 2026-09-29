package com.resolvedesk.tickets.application;

public class InvalidTicketQueryException extends RuntimeException {
    public InvalidTicketQueryException(String message) {
        super(message);
    }
}
