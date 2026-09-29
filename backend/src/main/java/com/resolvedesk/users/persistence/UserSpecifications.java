package com.resolvedesk.users.persistence;

import com.resolvedesk.users.application.UserListQuery;
import com.resolvedesk.users.domain.User;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class UserSpecifications {
    private UserSpecifications() {
    }

    public static Specification<User> matches(UserListQuery query) {
        return (root, criteriaQuery, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (query.role() != null) predicates.add(criteriaBuilder.equal(root.get("role"), query.role()));
            if (query.active() != null) predicates.add(criteriaBuilder.equal(root.get("active"), query.active()));
            if (query.search() != null) {
                String pattern = "%" + query.search().toLowerCase(Locale.ROOT) + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("firstName")), pattern),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("lastName")), pattern),
                        criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.concat(criteriaBuilder.concat(root.get("firstName"), " "), root.get("lastName"))), pattern),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), pattern)
                ));
            }
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }
}
