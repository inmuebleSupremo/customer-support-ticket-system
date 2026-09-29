package com.resolvedesk.tickets.comments.api;

import java.time.Instant;

public record CommentResponse(Long id, CommentAuthorResponse author, String content, Instant createdAt) {
}
