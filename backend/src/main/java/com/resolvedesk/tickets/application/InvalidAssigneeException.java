package com.resolvedesk.tickets.application;

public class InvalidAssigneeException extends RuntimeException {
    public InvalidAssigneeException() {
        super("The selected user is not an active agent.");
    }
}
