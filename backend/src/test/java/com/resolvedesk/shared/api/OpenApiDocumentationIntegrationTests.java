package com.resolvedesk.shared.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiDocumentationIntegrationTests {

    @Autowired private MockMvc mockMvc;

    @Test
    void generatedOpenApiDocumentExposesTheImplementedRestEndpoints() throws Exception {
        mockMvc.perform(get("/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/auth/register'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/logout'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/csrf'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/me/teams'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/{id}/role'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/users/{id}/active'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/agents'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/teams'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/teams'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/teams/{id}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/teams/{id}/name'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/teams/{id}/active'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/teams/{id}/members/{userId}'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/teams/{id}/members/{userId}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets/{id}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets/{id}/history'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets/{id}/assignee'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets/{id}/status'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets/{id}/priority'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets/{ticketId}/comments'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/tickets/{ticketId}/comments'].post").exists());
    }
}
