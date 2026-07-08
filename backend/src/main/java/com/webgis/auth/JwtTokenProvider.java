package com.webgis.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;
import java.util.List;

/**
 * JWT 令牌工厂 — 生成/解析/验证 JWT
 * <p>
 * 职责只跟 token 本身打交道（加密算法、有效期、从 token 提取字段），
 * 不查数据库、不管用户状态。用户查询由 {@link com.webgis.config.UserDetailsServiceImpl} 负责。
 * <p>
 * 签名算法：HMAC-SHA256（HS256），密钥从 application.yml 的 jwt.secret 读取。
 */
@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long expiration;      // 令牌有效期（毫秒），默认 86400000 = 24 小时

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long expiration) {
        byte[] keyBytes = Base64.getDecoder().decode(secret);
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);      // HMAC-SHA256 密钥
        this.expiration = expiration;
    }

    /**
     * 生成 JWT 令牌
     *
     * @param userId   用户 ID（存入 subject 声明）
     * @param username 用户名（存入自定义声明）
     * @param role     角色名（存入自定义声明，如 "admin"）
     * @return 签名的 JWT 字符串，格式: xxx.yyy.zzz
     */
    public String generateToken(Long userId, String username, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("username", username)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey)
                .compact();
    }

    /**
     * 解析 JWT token，提取其中存放的所有 Claims（声明）
     * <p>
     * 如果 token 签名无效、已过期或格式错误，直接抛异常（由 validateToken 捕获）。
     */
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * 验证 token 是否合法（签名正确 + 未过期）
     *
     * @return true 表示 token 有效
     */
    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** 从 token 中提取用户 ID（subject 声明） */
    public Long getUserIdFromToken(String token) {
        return Long.parseLong(parseToken(token).getSubject());
    }

    /** 从 token 中提取用户名（自定义声明） */
    public String getUsernameFromToken(String token) {
        return parseToken(token).get("username", String.class);
    }

    /**
     * 从 token 中提取角色，包装为 Spring Security 的 ROLE_ 前缀格式
     * <p>
     * 例：token 中的 role = "admin" → 返回 ["ROLE_ADMIN"]
     */
    public List<String> getRolesFromToken(String token) {
        String role = parseToken(token).get("role", String.class);
        return List.of("ROLE_" + role.toUpperCase());
    }
}
