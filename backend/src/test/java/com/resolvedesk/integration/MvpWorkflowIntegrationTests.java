package com.resolvedesk.integration;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.tickets.comments.persistence.CommentRepository;
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
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MvpWorkflowIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private TicketRepository ticketRepository;
    @Autowired private TicketHistoryRepository ticketHistoryRepository;
    @Autowired private CommentRepository commentRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @AfterEach
    void cleanDatabase() {
        commentRepository.deleteAll();
        ticketHistoryRepository.deleteAll();
        ticketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void completeMvpWorkflowPreservesAuthorizationLifecycleAndAuditHistory() throws Exception {
        MockHttpSession customerSession = registerAndLoginCustomer();
        User customer = userRepository.findByEmail("customer@example.com").orElseThrow();
        User agent = persistedUser("agent@example.com", UserRole.AGENT);
        User administrator = persistedUser("admin@example.com", UserRole.ADMIN);
        User candidate = persistedUser("candidate@example.com", UserRole.CUSTOMER);

        MvcResult ticketResult = mockMvc.perform(post("/api/v1/tickets").session(customerSession).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Cannot access billing\",\"description\":\"I cannot access the billing section in my account.\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andReturn();
        Number ticketIdValue = com.jayway.jsonpath.JsonPath.read(ticketResult.getResponse().getContentAsString(), "$.id");
        long ticketId = ticketIdValue.longValue();

        mockMvc.perform(post("/api/v1/tickets/{id}/comments", ticketId).session(customerSession).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Please help me regain access.\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.author.id").value(customer.getId()));
        mockMvc.perform(get("/api/v1/tickets/{id}", ticketId).session(customerSession))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(get("/api/v1/tickets?status=OPEN&search=SUP-{id}", ticketId).with(authentication(agent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        changeAssignee(agent, ticketId, agent.getId(), 1, 2);
        changeStatus(agent, ticketId, "IN_PROGRESS", 2, 3);
        changePriority(agent, ticketId, "HIGH", 3, 4);
        mockMvc.perform(post("/api/v1/tickets/{id}/comments", ticketId).with(authentication(agent)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"I am investigating the billing access issue.\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.author.id").value(agent.getId()));
        changeStatus(agent, ticketId, "RESOLVED", 5, 6);
        changeStatus(customerSession, ticketId, "IN_PROGRESS", 6, 7);
        changeStatus(agent, ticketId, "RESOLVED", 7, 8);
        changeStatus(agent, ticketId, "CLOSED", 8, 9);

        mockMvc.perform(get("/api/v1/tickets/{id}/comments", ticketId).session(customerSession))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/v1/tickets/{id}/history", ticketId).session(customerSession))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(8))
                .andExpect(jsonPath("$[0].eventType").value("TICKET_CREATED"))
                .andExpect(jsonPath("$[1].eventType").value("ASSIGNMENT_CHANGED"))
                .andExpect(jsonPath("$[2].eventType").value("STATUS_CHANGED"))
                .andExpect(jsonPath("$[3].eventType").value("PRIORITY_CHANGED"))
                .andExpect(jsonPath("$[7].newValue").value("CLOSED"));

        mockMvc.perform(get("/api/v1/users?role=CUSTOMER").with(authentication(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.id == " + candidate.getId() + ")]").isNotEmpty());
        mockMvc.perform(patch("/api/v1/users/{id}/role", candidate.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"AGENT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("AGENT"));
        mockMvc.perform(patch("/api/v1/users/{id}/active", candidate.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mockMvc.perform(patch("/api/v1/users/{id}/active", administrator.getId()).with(authentication(administrator)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMIN"));
    }

    private MockHttpSession registerAndLoginCustomer() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Customer\",\"lastName\":\"Example\",\"email\":\"customer@example.com\",\"password\":\"ExamplePassword123!\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("CUSTOMER"));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"customer@example.com\",\"password\":\"ExamplePassword123!\"}"))
                .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) login.getRequest().getSession(false);
    }

    private void changeAssignee(User actor, long ticketId, long assigneeId, long version, long expectedVersion) throws Exception {
        mockMvc.perform(patch("/api/v1/tickets/{id}/assignee", ticketId).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"agentId\":" + assigneeId + ",\"version\":" + version + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(expectedVersion));
    }

    private void changePriority(User actor, long ticketId, String priority, long version, long expectedVersion) throws Exception {
        mockMvc.perform(patch("/api/v1/tickets/{id}/priority", ticketId).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"priority\":\"" + priority + "\",\"version\":" + version + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(expectedVersion));
    }

    private void changeStatus(User actor, long ticketId, String status, long version, long expectedVersion) throws Exception {
        mockMvc.perform(patch("/api/v1/tickets/{id}/status", ticketId).with(authentication(actor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\",\"version\":" + version + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(expectedVersion));
    }

    private void changeStatus(MockHttpSession session, long ticketId, String status, long version, long expectedVersion) throws Exception {
        mockMvc.perform(patch("/api/v1/tickets/{id}/status", ticketId).session(session).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\",\"version\":" + version + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(expectedVersion));
    }

    private User persistedUser(String email, UserRole role) {
        return userRepository.saveAndFlush(User.create(email, passwordEncoder.encode("ExamplePassword123!"), "Test", role.name(), role));
    }

    private RequestPostProcessor authentication(User user) {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(user));
    }
}
