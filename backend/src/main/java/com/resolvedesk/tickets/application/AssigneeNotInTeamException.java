package com.resolvedesk.tickets.application;

public class AssigneeNotInTeamException extends RuntimeException {
    public AssigneeNotInTeamException() {
        super("The assigned agent must be a current member of the ticket's team.");
    }
}
