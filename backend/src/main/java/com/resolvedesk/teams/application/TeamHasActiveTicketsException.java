package com.resolvedesk.teams.application;

public class TeamHasActiveTicketsException extends RuntimeException {
    public TeamHasActiveTicketsException() {
        super("Reassign or clear this team's non-closed tickets before deactivating it.");
    }
}
