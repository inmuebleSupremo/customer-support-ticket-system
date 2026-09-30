package com.resolvedesk.shared.api;

import com.resolvedesk.ResolveDeskApplication;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class MySqlFlywayMigrationIntegrationTests {

    @Container
    private static final MySQLContainer<?> mysql = new MySQLContainer<>(DockerImageName.parse("mysql:8.0.36"))
            .withDatabaseName("resolvedesk")
            .withUsername("resolvedesk")
            .withPassword("resolvedesk");

    @BeforeEach
    void cleanDatabase() {
        Flyway.configure()
                .dataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword())
                .locations("classpath:db/migration")
                .cleanDisabled(false)
                .load()
                .clean();
    }

    @Test
    void migratesAFreshMySql8DatabaseThroughV7AndHibernateValidatesTheSchema() throws Exception {
        assertThat(flyway().migrate().migrationsExecuted).isEqualTo(7);

        try (ConfigurableApplicationContext ignored = new SpringApplicationBuilder(ResolveDeskApplication.class)
                .web(WebApplicationType.NONE)
                .run(
                        "--spring.datasource.url=" + mysql.getJdbcUrl(),
                        "--spring.datasource.username=" + mysql.getUsername(),
                        "--spring.datasource.password=" + mysql.getPassword(),
                        "--spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver",
                        "--spring.flyway.enabled=false",
                        "--spring.jpa.hibernate.ddl-auto=validate",
                        "--resolvedesk.bootstrap-admin.email="
                )) {
            assertThat(tableCount()).isEqualTo(6);
        }
    }

    @Test
    void upgradesRepresentativeV4DataThroughV7WithoutRewritingIt() throws Exception {
        assertThat(flyway(MigrationVersion.fromVersion("4")).migrate().migrationsExecuted).isEqualTo(4);

        long customerId;
        long agentId;
        long ticketId;
        try (Connection connection = connection()) {
            customerId = insertUser(connection, "customer@example.com", "CUSTOMER");
            agentId = insertUser(connection, "agent@example.com", "AGENT");
            ticketId = insertTicket(connection, customerId, agentId);
            insertHistory(connection, ticketId, agentId, "TICKET_CREATED");
            insertComment(connection, ticketId, agentId);
        }

        assertThat(flyway().migrate().migrationsExecuted).isEqualTo(3);

        try (Connection connection = connection()) {
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT title, assigned_team_id FROM tickets WHERE id = ?"
            )) {
                statement.setLong(1, ticketId);
                try (ResultSet result = statement.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getString("title")).isEqualTo("Existing ticket");
                    assertThat(result.getObject("assigned_team_id")).isNull();
                }
            }
            assertThat(count(connection, "ticket_history", ticketId)).isEqualTo(1);
            assertThat(count(connection, "comments", ticketId)).isEqualTo(1);

            long teamId = insertTeam(connection);
            try (PreparedStatement member = connection.prepareStatement(
                    "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)"
            ); PreparedStatement route = connection.prepareStatement(
                    "UPDATE tickets SET assigned_team_id = ? WHERE id = ?"
            )) {
                member.setLong(1, teamId);
                member.setLong(2, agentId);
                assertThat(member.executeUpdate()).isEqualTo(1);
                route.setLong(1, teamId);
                route.setLong(2, ticketId);
                assertThat(route.executeUpdate()).isEqualTo(1);
            }
            insertHistory(connection, ticketId, agentId, "TEAM_CHANGED");
            assertThat(count(connection, "ticket_history", ticketId)).isEqualTo(2);
        }
    }

    private Flyway flyway() {
        return flyway(null);
    }

    private Flyway flyway(MigrationVersion target) {
        var configuration = Flyway.configure()
                .dataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword())
                .locations("classpath:db/migration");
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }

    private Connection connection() throws Exception {
        return DriverManager.getConnection(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword());
    }

    private int tableCount() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() "
                        + "AND table_name IN ('users', 'tickets', 'ticket_history', 'comments', 'teams', 'team_members')"
        )) {
            assertThat(result.next()).isTrue();
            return result.getInt(1);
        }
    }

    private long insertUser(Connection connection, String email, String role) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO users (email, password_hash, first_name, last_name, role, active) VALUES (?, 'hash', 'Test', 'User', ?, TRUE)",
                Statement.RETURN_GENERATED_KEYS
        )) {
            statement.setString(1, email);
            statement.setString(2, role);
            assertThat(statement.executeUpdate()).isEqualTo(1);
            try (ResultSet keys = statement.getGeneratedKeys()) {
                assertThat(keys.next()).isTrue();
                return keys.getLong(1);
            }
        }
    }

    private long insertTicket(Connection connection, long customerId, long agentId) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO tickets (customer_id, assigned_agent_id, title, description, status, priority) "
                        + "VALUES (?, ?, 'Existing ticket', 'A representative v1 support issue.', 'OPEN', 'MEDIUM')",
                Statement.RETURN_GENERATED_KEYS
        )) {
            statement.setLong(1, customerId);
            statement.setLong(2, agentId);
            assertThat(statement.executeUpdate()).isEqualTo(1);
            try (ResultSet keys = statement.getGeneratedKeys()) {
                assertThat(keys.next()).isTrue();
                return keys.getLong(1);
            }
        }
    }

    private void insertHistory(Connection connection, long ticketId, long actorId, String eventType) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO ticket_history (ticket_id, actor_user_id, event_type, field_name, old_value, new_value) "
                        + "VALUES (?, ?, ?, NULL, NULL, NULL)"
        )) {
            statement.setLong(1, ticketId);
            statement.setLong(2, actorId);
            statement.setString(3, eventType);
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
    }

    private void insertComment(Connection connection, long ticketId, long authorId) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO comments (ticket_id, author_id, content) VALUES (?, ?, 'Existing comment')"
        )) {
            statement.setLong(1, ticketId);
            statement.setLong(2, authorId);
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
    }

    private long insertTeam(Connection connection) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO teams (name, active) VALUES ('Technical Support', TRUE)", Statement.RETURN_GENERATED_KEYS
        )) {
            assertThat(statement.executeUpdate()).isEqualTo(1);
            try (ResultSet keys = statement.getGeneratedKeys()) {
                assertThat(keys.next()).isTrue();
                return keys.getLong(1);
            }
        }
    }

    private int count(Connection connection, String tableName, long ticketId) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("SELECT COUNT(*) FROM " + tableName + " WHERE ticket_id = ?")) {
            statement.setLong(1, ticketId);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getInt(1);
            }
        }
    }
}
