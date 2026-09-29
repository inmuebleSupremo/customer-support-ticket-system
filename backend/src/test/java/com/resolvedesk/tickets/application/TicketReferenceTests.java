package com.resolvedesk.tickets.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TicketReferenceTests {

    @Test
    void formatsAndParsesPublicReferencesWithoutPersistingThem() {
        assertThat(TicketReference.format(1042)).isEqualTo("SUP-1042");
        assertThat(TicketReference.parse("sup-1042")).contains(1042L);
        assertThat(TicketReference.parse("SUP-0")).isEmpty();
        assertThat(TicketReference.parse("ticket-1042")).isEmpty();
    }
}
