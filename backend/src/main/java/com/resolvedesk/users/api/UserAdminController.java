package com.resolvedesk.users.api;

import com.resolvedesk.shared.api.PageResponse;
import com.resolvedesk.users.application.UserAdministrationService;
import com.resolvedesk.users.application.UserListQuery;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserAdminController {
    private final UserAdministrationService userAdministrationService;

    public UserAdminController(UserAdministrationService userAdministrationService) {
        this.userAdministrationService = userAdministrationService;
    }

    @GetMapping
    public PageResponse<UserSummaryResponse> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String active,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        return userAdministrationService.listUsers(UserListQuery.from(role, active, search, page, size, sort));
    }

    @PatchMapping("/{id}/role")
    public UserMutationResponse changeRole(@PathVariable long id, @Valid @RequestBody ChangeUserRoleRequest request) {
        return userAdministrationService.changeRole(id, request.role());
    }

    @PatchMapping("/{id}/active")
    public UserMutationResponse changeActive(@PathVariable long id, @Valid @RequestBody ChangeUserActiveStateRequest request) {
        return userAdministrationService.changeActive(id, request.active());
    }
}
