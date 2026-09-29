package com.resolvedesk.tickets.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.tickets.history.domain.TicketEventType;
import com.resolvedesk.tickets.history.domain.TicketHistory;
import com.resolvedesk.tickets.history.persistence.TicketHistoryRepository;
import com.resolvedesk.tickets.persistence.TicketRepository;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import com.resolvedesk.users.persistence.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TicketCreationIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private TicketHistoryRepository ticketHistoryRepository;

    @AfterEach
    void cleanDatabase() {
        ticketHistoryRepository.deleteAll();
        ticketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void customerCreatesTicketWithDocumentedDefaultsReferenceAndHistory() throws Exception {
        User customer = persistedUser(UserRole.CUSTOMER, "customer@example.com");

        mockMvc.perform(createTicket(customer, new CreateTicketRequest("Unable to reset my password", "The reset email has not arrived.")))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", matchesPattern("/api/v1/tickets/\\d+")))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.reference").value(matchesPattern("SUP-\\d+")))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.priority").value("MEDIUM"))
                .andExpect(jsonPath("$.customer.id").value(customer.getId()))
                .andExpect(jsonPath("$.assignedAgent").value(nullValue()))
                .andExpect(jsonPath("$.resolvedAt").value(nullValue()))
                .andExpect(jsonPath("$.closedAt").value(nullValue()))
                .andExpect(jsonPath("$.version").value(0));

        Ticket ticket = ticketRepository.findAll().getFirst();
        assertThat(ticket.getCustomer().getId()).isEqualTo(customer.getId());
        assertThat(ticket.getAssignedAgent()).isNull();
        assertThat(ticket.getResolvedAt()).isNull();
        assertThat(ticket.getClosedAt()).isNull();
        assertThat(ticket.getVersion()).isZero();

        List<TicketHistory> history = ticketHistoryRepository.findAll();
        assertThat(history).singleElement().satisfies(event -> {
            assertThat(event.getTicket().getId()).isEqualTo(ticket.getId());
            assertThat(event.getActor().getId()).isEqualTo(customer.getId());
            assertThat(event.getEventType()).isEqualTo(TicketEventType.TICKET_CREATED);
            assertThat(event.getFieldName()).isNull();
            assertThat(event.getOldValue()).isNull();
            assertThat(event.getNewValue()).isNull();
        });
    }

    @Test
    void clientCannotSupplyTicketOwnershipOrControlledFields() throws Exception {
        User customer = persistedUser(UserRole.CUSTOMER, "customer@example.com");
        String requestWithSpoofedOwner = "{\"title\":\"Unable to sign in\",\"description\":\"I cannot sign in to my account.\",\"customerId\":999,\"status\":\"CLOSED\"}";

        mockMvc.perform(post("/api/v1/tickets")
                        .with(SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(customer)))
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestWithSpoofedOwner))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        assertThat(ticketRepository.count()).isZero();
    }

    @Test
    void validatesTitleAndDescriptionBoundaries() throws Exception {
        User customer = persistedUser(UserRole.CUSTOMER, "customer@example.com");

        mockMvc.perform(createTicket(customer, new CreateTicketRequest(" ", " ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.title").exists())
                .andExpect(jsonPath("$.fieldErrors.description").exists());

        mockMvc.perform(createTicket(customer, new CreateTicketRequest("Hi", "Valid ticket description.")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.title").exists());

        mockMvc.perform(createTicket(customer, new CreateTicketRequest("Valid title", "Too short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.description").exists());
    }

    @Test
    void onlyCustomersMayCreateTickets() throws Exception {
        User agent = persistedUser(UserRole.AGENT, "agent@example.com");
        User administrator = persistedUser(UserRole.ADMIN, "admin@example.com");
        CreateTicketRequest request = new CreateTicketRequest("Valid ticket title", "This description is sufficiently long.");

        mockMvc.perform(createTicket(agent, request)).andExpect(status().isForbidden());
        mockMvc.perform(createTicket(administrator, request)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/tickets")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder createTicket(User user, CreateTicketRequest request) throws Exception {
        return post("/api/v1/tickets")
                .with(SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(user)))
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request));
    }

    private User persistedUser(UserRole role, String email) {
        return userRepository.saveAndFlush(User.create(email, "password-hash", "Test", "User", role));
    }
}
