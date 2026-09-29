CREATE TABLE tickets (
    id BIGINT NOT NULL AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    assigned_agent_id BIGINT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_at DATETIME(6) NULL,
    closed_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pk_tickets PRIMARY KEY (id),
    CONSTRAINT fk_tickets_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_assigned_agent FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT ck_tickets_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    CONSTRAINT ck_tickets_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'))
);

CREATE INDEX idx_tickets_customer_created ON tickets (customer_id, created_at);
CREATE INDEX idx_tickets_status_priority_created ON tickets (status, priority, created_at);
CREATE INDEX idx_tickets_agent_status ON tickets (assigned_agent_id, status);
CREATE INDEX idx_tickets_updated ON tickets (updated_at);
