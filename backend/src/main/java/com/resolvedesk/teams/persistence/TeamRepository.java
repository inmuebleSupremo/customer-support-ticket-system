package com.resolvedesk.teams.persistence;

import com.resolvedesk.teams.domain.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import java.util.List;

public interface TeamRepository extends JpaRepository<Team, Long> {
    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    List<Team> findByActiveTrueOrderByNameAsc();

    List<Team> findDistinctByMembersId(Long userId);

    List<Team> findDistinctByMembersIdAndActiveTrueOrderByNameAsc(Long userId);

    boolean existsByIdAndMembersId(Long teamId, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select team from Team team where team.id = :teamId")
    java.util.Optional<Team> findByIdForUpdate(Long teamId);
}
