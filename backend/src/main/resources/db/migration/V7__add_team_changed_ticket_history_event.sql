ALTER TABLE ticket_history DROP CONSTRAINT ck_ticket_history_event_type;

ALTER TABLE ticket_history
    ADD CONSTRAINT ck_ticket_history_event_type
    CHECK (event_type IN ('TICKET_CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNMENT_CHANGED', 'TEAM_CHANGED'));
