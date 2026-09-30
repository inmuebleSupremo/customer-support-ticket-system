package com.resolvedesk.shared.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class FlywayFoundationTests {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void flywayCreatesTheVersionedFoundationAndTicketSchemas() {
        Integer tableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' "
                        + "AND UPPER(TABLE_NAME) IN ('USERS', 'TICKETS', 'TICKET_HISTORY', 'COMMENTS', 'TEAMS', 'TEAM_MEMBERS')",
                Integer.class
        );

        assertThat(tableCount).isEqualTo(6);
    }
}
