package com.webgis.config;

import com.webgis.auth.JwtAuthFilter;          // 自定义的 JWT 过滤器（校验 Token）
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;       // 用于区分 GET/POST 等请求方法
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security 核心配置类
 * 1. 定义哪些接口需要登录、哪些不需要
 * 2. 配置密码加密方式（BCrypt）
 * 3. 配置 JWT 过滤器，让 Token 校验生效
 */
@Configuration
@EnableWebSecurity  // 启用 Spring Security 的 Web 安全功能
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    /**
     * 构造器注入 JWT 过滤器（由 Spring 自动装配）
     */
    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    // ==========================================================
    // 核心：安全过滤链（定义所有接口的访问规则）
    // ==========================================================

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                // 1. 关闭 CSRF（跨站请求伪造）防护
                //    因为 JWT 是无状态的，不需要 Cookie/Session，所以 CSRF 攻击不适用
                .csrf(csrf -> csrf.disable())

                // 2. 会话管理：设置为“无状态”
                //    意思是 Spring Security 不创建也不使用 HttpSession，
                //    完全靠 JWT Token 来识别用户（符合 RESTful 规范）
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // 3. 定义接口权限规则（核心业务逻辑）
                .authorizeHttpRequests(auth -> auth
                        // ---- 放行区（无需登录即可访问） ----
                        // 登录和注册接口，所有人都能访问
                        .requestMatchers("/api/auth/login", "/api/auth/register").permitAll()
                        // 健康检查接口，用于监控/探测服务是否存活
                        .requestMatchers("/api/health").permitAll()
                        // GeoServer 代理接口，全部放行（前端直接调这个接口来获取地图数据）
                        .requestMatchers("/api/geoserver/**").permitAll()

                        // ---- 必须登录区（携带有效 Token） ----
                        // 获取当前用户信息，必须登录
                        .requestMatchers("/api/auth/me").authenticated()
                        // GET 方式访问空间数据接口，必须登录
                        .requestMatchers(HttpMethod.GET, "/api/spatial/**").authenticated()
                        // 文件操作接口，必须登录
                        .requestMatchers("/api/files/**").authenticated()

                        // ---- 管理员专属区（需要 ADMIN 角色） ----
                        // 注意：Spring Security 的 hasRole("ADMIN") 会自动补前缀，
                        // 即数据库里该用户的角色字段必须存为 "ROLE_ADMIN" 或配置的 prefix，
                        // 但你在 DataInitializer 里设置的是 "admin"，这里需要保持一致（或者改成 hasAuthority）
                        .requestMatchers("/api/system/**").hasRole("ADMIN")

                        // ---- 默认规则 ----
                        // 除了上面明确声明的，其他所有接口都必须登录（authenticated）
                        .anyRequest().authenticated()
                )

                // 4. 添加自定义 JWT 过滤器
                //    把 jwtAuthFilter 放在 UsernamePasswordAuthenticationFilter 之前，
                //    UsernamePasswordAuthenticationFilter是 Spring Security 内置的处理用户名/密码登录的过滤器。
                //    意思是：在处理用户名/密码登录之前，先检查 Header 里有没有 JWT Token。
                //    如果有且有效，直接通过；如果没有，再走后续的登录流程。
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

                .build();
        // 构建完返回 SecurityFilterChain，Spring 就会用这套规则拦截所有请求
    }

    // ==========================================================
    // 密码编码器
    // ==========================================================

    /**
     * 使用 BCrypt 强哈希算法对密码进行加密
     *
     * 特点：
     * - 每次加密出的密文都不同（因为内置随机盐）
     * - 即使两个用户的密码都是 "123456"，密文也不一样
     * - 安全性极高，目前无法暴力破解
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ==========================================================
    // 认证管理器（AuthenticationManager）
    // ==========================================================

    /**
     * Spring Security 的核心认证组件，负责：
     * 1. 接收用户名+密码
     * 2. 调用 UserDetailsService 去数据库查用户
     * 3. 比较密码是否匹配
     *
     * 这里用 AuthenticationConfiguration 获取默认的 Manager，
     * 它会自动读取你在项目中配置的 UserDetailsService 和 PasswordEncoder。
     *
     * 这个 Bean 会在 AuthController 中被注入，用于处理 /login 接口
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}