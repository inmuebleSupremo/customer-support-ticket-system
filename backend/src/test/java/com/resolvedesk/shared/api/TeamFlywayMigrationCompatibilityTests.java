package com.resolvedesk.shared.api;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

class TeamFlywayMigrationCompatibilityTests {

    @Test
    void existingV4TicketsUpgradeWithoutDataRewriteAndAcceptTeamHistory() throws Exception {
        String url = "jdbc:h2:mem:team_upgrade;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";
        Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("4")).load().migrate();

        try (Connection connection = DriverManager.getConnection(url, "sa", ""); Statement statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO users (email, password_hash, first_name, last_name, role, active) "
                    + "VALUES ('customer@example.com', 'hash', 'Test', 'Customer', 'CUSTOMER', TRUE)");
            statement.executeUpdate("INSERT INTO tickets (customer_id, title, description, status, priority) "
                    + "VALUES (1, 'Existing ticket', 'An existing v1 support issue.', 'OPEN', 'MEDIUM')");
        }

        Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").load().migrate();

        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(
                    "SELECT assigned_team_id FROM tickets WHERE id = 1"
            )) {
                assertThat(result.next()).isTrue();
                assertThat(result.getObject("assigned_team_id")).isNull();
            }
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO teams (name, active) VALUES ('Technical Support', TRUE)");
                statement.executeUpdate("UPDATE tickets SET assigned_team_id = 1 WHERE id = 1");
            }
            try (PreparedStatement history = connection.prepareStatement(
                    "INSERT INTO ticket_history (ticket_id, actor_user_id, event_type, field_name, old_value, new_value) "
                            + "VALUES (?, ?, ?, ?, ?, ?)"
            )) {
                history.setLong(1, 1);
                history.setLong(2, 1);
                history.setString(3, "TEAM_CHANGED");
                history.setString(4, "assignedTeam");
                history.setObject(5, null);
                history.setString(6, "1");
                assertThat(history.executeUpdate()).isEqualTo(1);
            }
        }
    }
}
