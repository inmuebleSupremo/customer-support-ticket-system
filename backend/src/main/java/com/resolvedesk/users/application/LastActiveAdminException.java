package com.resolvedesk.users.application;

public class LastActiveAdminException extends RuntimeException {
    public LastActiveAdminException() {
        super("The final active administrator cannot be demoted or deactivated.");
    }
}
