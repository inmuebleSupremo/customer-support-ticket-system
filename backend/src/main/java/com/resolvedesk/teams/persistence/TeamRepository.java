package com.resolvedesk.teams.persistence;

import com.resolvedesk.teams.domain.Team;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeamRepository extends JpaRepository<Team, Long> {
    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    List<Team> findByActiveTrueOrderByNameAsc();

    List<Team> findDistinctByMembersId(Long userId);

    List<Team> findDistinctByMembersIdAndActiveTrueOrderByNameAsc(Long userId);
}
