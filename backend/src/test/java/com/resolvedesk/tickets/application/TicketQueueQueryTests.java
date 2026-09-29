package com.resolvedesk.tickets.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TicketQueueQueryTests {

    @Test
    void acceptsEveryWhitelistedSortProperty() {
        for (String property : new String[]{"createdAt", "updatedAt", "priority", "status", "title"}) {
            assertThat(TicketQueueQuery.from(null, null, null, null, null, "0", "20", property + ",asc").sort().getOrderFor(property)).isNotNull();
        }
    }

    @Test
    void rejectsUnsupportedSortProperty() {
        assertThatThrownBy(() -> TicketQueueQuery.from(null, null, null, null, null, "0", "20", "customer,desc"))
                .isInstanceOf(InvalidTicketQueryException.class);
    }
}
