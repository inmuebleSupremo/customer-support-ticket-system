package com.resolvedesk.teams.application;

public class TeamMemberHasActiveTicketsException extends RuntimeException {
    public TeamMemberHasActiveTicketsException() {
        super("Reassign, unassign, or route the member's non-closed team tickets before removing membership.");
    }
}
