package com.resolvedesk.users.application;

public class InvalidUserQueryException extends RuntimeException {
    public InvalidUserQueryException(String message) {
        super(message);
    }
}
