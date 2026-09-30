package com.resolvedesk.teams.application;

public class TeamNotFoundException extends RuntimeException {
    public TeamNotFoundException(long teamId) {
        super("Team " + teamId + " was not found.");
    }
}
