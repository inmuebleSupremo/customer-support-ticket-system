package com.resolvedesk.teams.application;

public class TeamNameAlreadyExistsException extends RuntimeException {
    public TeamNameAlreadyExistsException() {
        super("A team with this name already exists.");
    }
}
