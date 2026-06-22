package com.webgis.system.web;

import com.webgis.common.Result;
import com.webgis.system.entity.User;
import com.webgis.system.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/system/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public Result<List<User>> list() {
        return Result.success(userService.findAll());
    }

    @GetMapping("/{id}")
    public Result<User> getById(@PathVariable Long id) {
        return Result.success(userService.findById(id));
    }

    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        userService.updateStatus(id, status);
        return Result.success();
    }
}
