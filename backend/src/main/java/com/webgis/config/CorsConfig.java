package com.webgis.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * 跨域资源共享（CORS）配置类
 * 用于解决前后端分离开发中，前端（如 Vue/React）访问后端 API 时被浏览器拦截的问题
 */
@Configuration
public class CorsConfig {

    /**
     * 注册 CORS 过滤器，对所有请求生效
     */
    @Bean
    public CorsFilter corsFilter() {
        // 1. 创建 CORS 配置对象
        CorsConfiguration config = new CorsConfiguration();

        // 允许哪些源（域名/端口）访问？使用通配符 "*" 代表允许所有源
        // 注意：如果设置了 allowCredentials(true)，则不能使用 "*"，这里用 "setAllowedOriginPatterns" 代替
        config.setAllowedOriginPatterns(List.of("*"));

        // 允许哪些 HTTP 方法？GET、POST、PUT、DELETE、OPTIONS（预检请求）
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        // 允许携带哪些请求头？"*" 代表所有
        config.setAllowedHeaders(List.of("*"));

        // 是否允许携带凭证（如 Cookie、Authorization 头）？设置为 true 表示允许
        config.setAllowCredentials(true);

        // 预检请求（OPTIONS）的缓存时间，单位秒。3600 秒 = 1 小时
        // 在这段时间内，浏览器不会再发送预检请求，减少不必要的请求
        config.setMaxAge(3600L);

        // 2. 创建 CORS 配置源，并注册到所有路径（/**）上
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        // 3. 返回 CORS 过滤器，交给 Spring 管理
        return new CorsFilter(source);
    }
}