package com.webgis.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.webgis.system.entity.User;
import com.webgis.system.mapper.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    public User createUser(String username, String password, String displayName) {
        boolean exists = userMapper.exists(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (exists) {
            throw new IllegalArgumentException("用户名已存在");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setDisplayName(displayName != null ? displayName : username);
        user.setRole("user");
        user.setStatus(1);
        userMapper.insert(user);
        return user;
    }

    public User findByUsername(String username) {
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }
        return user;
    }

    public List<User> findAll() {
        return userMapper.selectList(null);
    }

    public User findById(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }
        return user;
    }

    public void updateStatus(Long id, Integer status) {
        User user = findById(id);
        user.setStatus(status);
        userMapper.updateById(user);
    }
}
