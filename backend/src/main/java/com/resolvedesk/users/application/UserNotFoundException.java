package com.resolvedesk.users.application;

public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(long id) {
        super("User " + id + " was not found.");
    }
}
