package com.webgis.auth;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * 当前登录用户 — 实现 Spring Security 的 UserDetails 接口
 * <p>
 * 存储用户 ID、用户名和权限列表，作为 SecurityContext 中的"当事人"。
 * 这里的密码逻辑：
 * <ul>
 *   <li>JwtAuthFilter 从 token 构造的 LoginUser：不需要密码，{@link #getPassword()} 返回 null</li>
 *   <li>登录验证时：由 {@link com.webgis.config.UserDetailsServiceImpl} 使用匿名子类覆盖 getPassword()，
 *       从数据库 User 对象取真实密码交给 Spring Security 校验</li>
 * </ul>
 */
public class LoginUser implements UserDetails {

    private final Long userId;
    private final String username;
    private final List<? extends GrantedAuthority> authorities;

    public LoginUser(Long userId, String username, List<? extends GrantedAuthority> authorities) {
        this.userId = userId;
        this.username = username;
        this.authorities = authorities;
    }

    public Long getUserId() {
        return userId;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public String getPassword() {
        return null;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
