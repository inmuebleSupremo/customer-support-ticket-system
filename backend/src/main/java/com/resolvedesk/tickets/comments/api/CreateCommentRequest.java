package com.resolvedesk.tickets.comments.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCommentRequest(
        @NotBlank(message = "Comment content is required.")
        @Size(max = 3000, message = "Comment content must not exceed 3000 characters.")
        String content
) {
}
