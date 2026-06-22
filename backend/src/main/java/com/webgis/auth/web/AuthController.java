package com.webgis.auth.web;

import com.webgis.auth.JwtTokenProvider;
import com.webgis.auth.dto.LoginRequest;
import com.webgis.auth.dto.LoginResponse;
import com.webgis.auth.dto.RegisterRequest;
import com.webgis.common.Result;
import com.webgis.system.entity.User;
import com.webgis.system.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtTokenProvider jwtTokenProvider,
                          UserService userService) {
        this.authenticationManager = authenticationManager;
        this.jwtTokenProvider = jwtTokenProvider;
        this.userService = userService;
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        User user = userService.findByUsername(request.getUsername());
        String token = jwtTokenProvider.generateToken(user.getId(), user.getUsername(), user.getRole());

        LoginResponse response = new LoginResponse(
                token, user.getUsername(), user.getDisplayName(), user.getRole());
        return Result.success(response);
    }

    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterRequest request) {
        userService.createUser(request.getUsername(), request.getPassword(), request.getDisplayName());
        return Result.success();
    }
}
