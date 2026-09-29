package com.resolvedesk.tickets.comments.api;

import com.resolvedesk.users.domain.UserRole;

public record CommentAuthorResponse(Long id, String displayName, UserRole role) {
}
