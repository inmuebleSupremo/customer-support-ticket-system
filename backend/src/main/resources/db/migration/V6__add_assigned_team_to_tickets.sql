ALTER TABLE tickets ADD COLUMN assigned_team_id BIGINT NULL;

ALTER TABLE tickets
    ADD CONSTRAINT fk_tickets_assigned_team
    FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE RESTRICT;

CREATE INDEX idx_tickets_team_status ON tickets (assigned_team_id, status);
