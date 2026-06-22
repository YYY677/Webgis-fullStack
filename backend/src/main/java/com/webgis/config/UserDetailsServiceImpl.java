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
