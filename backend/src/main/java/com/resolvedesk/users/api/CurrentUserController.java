package com.resolvedesk.users.api;

import com.resolvedesk.auth.application.AuthenticatedUser;
import com.resolvedesk.users.application.UserResponseMapper;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class CurrentUserController {

    @GetMapping("/me")
    public CurrentUserResponse currentUser(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return UserResponseMapper.toCurrentUser(authenticatedUser.user());
    }
}
