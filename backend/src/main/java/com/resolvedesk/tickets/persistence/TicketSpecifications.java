package com.resolvedesk.tickets.persistence;

import com.resolvedesk.tickets.application.TicketQueueQuery;
import com.resolvedesk.tickets.application.TicketReference;
import com.resolvedesk.tickets.domain.Ticket;
import com.resolvedesk.users.domain.User;
import com.resolvedesk.users.domain.UserRole;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public final class TicketSpecifications {
    private TicketSpecifications() {
    }

    public static Specification<Ticket> queueFor(User actor, TicketQueueQuery query) {
        return (root, criteriaQuery, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (actor.getRole() == UserRole.CUSTOMER) {
                predicates.add(criteriaBuilder.equal(root.get("customer").get("id"), actor.getId()));
            }
            if (query.status() != null) predicates.add(criteriaBuilder.equal(root.get("status"), query.status()));
            if (query.priority() != null) predicates.add(criteriaBuilder.equal(root.get("priority"), query.priority()));
            if (query.assignedAgentId() != null) predicates.add(criteriaBuilder.equal(root.get("assignedAgent").get("id"), query.assignedAgentId()));
            if (query.unassigned()) predicates.add(criteriaBuilder.isNull(root.get("assignedAgent")));
            if (query.teamId() != null) predicates.add(criteriaBuilder.equal(root.get("assignedTeam").get("id"), query.teamId()));
            if (query.unassignedTeam()) predicates.add(criteriaBuilder.isNull(root.get("assignedTeam")));
            if (query.myTeams()) {
                var assignedTeam = root.join("assignedTeam");
                predicates.add(criteriaBuilder.isTrue(assignedTeam.get("active")));
                predicates.add(criteriaBuilder.equal(assignedTeam.join("members").get("id"), actor.getId()));
            }
            if (query.search() != null) addSearchPredicate(predicates, root, criteriaBuilder, query.search());
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static void addSearchPredicate(List<Predicate> predicates, jakarta.persistence.criteria.Root<Ticket> root,
                                           jakarta.persistence.criteria.CriteriaBuilder criteriaBuilder, String search) {
        Optional<Long> referenceId = TicketReference.parse(search);
        if (referenceId.isPresent()) {
            predicates.add(criteriaBuilder.equal(root.get("id"), referenceId.get()));
            return;
        }
        predicates.add(criteriaBuilder.like(
                criteriaBuilder.lower(root.get("title")),
                "%" + search.toLowerCase(Locale.ROOT) + "%"
        ));
    }
}
