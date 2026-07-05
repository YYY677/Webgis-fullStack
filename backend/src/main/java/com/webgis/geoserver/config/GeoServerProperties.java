package com.webgis.geoserver.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * GeoServer 连接配置 — 从 application.yml 的 geoserver 段读取
 */
@Component
@ConfigurationProperties(prefix = "geoserver")
public class GeoServerProperties {

    /** GeoServer REST API 根路径，如 http://localhost:8081/geoserver */
    private String url;

    /** 管理员用户名 */
    private String username;

    /** 管理员密码 */
    private String password;

    /** 默认工作空间 */
    private String workspace;

    // ── getters / setters ──────────────────────────────────────

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
}
