CREATE TABLE ticket_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT NOT NULL,
    actor_user_id BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    field_name VARCHAR(50) NULL,
    old_value VARCHAR(255) NULL,
    new_value VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_ticket_history PRIMARY KEY (id),
    CONSTRAINT fk_ticket_history_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT ck_ticket_history_event_type CHECK (event_type IN ('TICKET_CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNMENT_CHANGED'))
);

CREATE INDEX idx_ticket_history_ticket_created ON ticket_history (ticket_id, created_at);
