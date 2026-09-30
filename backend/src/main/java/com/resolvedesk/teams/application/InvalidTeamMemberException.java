package com.resolvedesk.teams.application;

public class InvalidTeamMemberException extends RuntimeException {
    public InvalidTeamMemberException() {
        super("Only AGENT users may be team members.");
    }
}
