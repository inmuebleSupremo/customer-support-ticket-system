package com.resolvedesk.tickets.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTicketRequest(
        @NotBlank(message = "Title is required.")
        @Size(min = 3, max = 120, message = "Title must contain between 3 and 120 characters.")
        String title,
        @NotBlank(message = "Description is required.")
        @Size(min = 10, max = 5000, message = "Description must contain between 10 and 5000 characters.")
        String description
) {
}
