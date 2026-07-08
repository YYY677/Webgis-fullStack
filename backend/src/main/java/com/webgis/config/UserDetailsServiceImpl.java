package com.webgis.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.webgis.auth.LoginUser;
import com.webgis.system.entity.User;
import com.webgis.system.mapper.UserMapper;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 用户详情查询 — Spring Security 的 UserDetailsService 实现
 * <p>
 * 只在登录时被调用一次：用户提交用户名+密码 → Spring Security 调 loadUserByUsername()
 * 查数据库 → 返回带密码的 LoginUser → Security 自动比对密码。
 * <p>
 * 登录成功后后续请求不再经过这里（JwtAuthFilter 直接读 token）。
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserMapper userMapper;

    public UserDetailsServiceImpl(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username));

        if (user == null) {
            throw new UsernameNotFoundException("用户不存在: " + username);
        }
        if (user.getStatus() != null && user.getStatus() != 1) {
            throw new UsernameNotFoundException("用户已被禁用");
        }

        List<SimpleGrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase()));

        return new LoginUser(user.getId(), user.getUsername(), authorities) {
            @Override
            public String getPassword() {
                return user.getPassword();
            }
        };
    }
}
