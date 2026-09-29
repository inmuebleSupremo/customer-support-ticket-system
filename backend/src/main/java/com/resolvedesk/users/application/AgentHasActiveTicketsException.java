package com.resolvedesk.users.application;

public class AgentHasActiveTicketsException extends RuntimeException {
    public AgentHasActiveTicketsException(String message) {
        super(message);
    }
}
