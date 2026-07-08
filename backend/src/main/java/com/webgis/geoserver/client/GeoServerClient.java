package com.webgis.geoserver.client;

import com.webgis.geoserver.config.GeoServerProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import static org.springframework.http.HttpHeaders.ACCEPT;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * GeoServer REST API 客户端 — 基于 Spring 6 RestClient
 * <p>
 * RestClient 是 Spring Boot 3.2 引入的同步 HTTP 客户端，替代 RestTemplate。
 * 本项目是 MVC(Tomcat) 架构，不需要 WebClient 的 Mono/Flux 异步模型，
 * RestClient 的同步 API 更直观、调用链更短。
 * <p>
 * GeoServer REST API 文档：<a href="https://docs.geoserver.org/stable/en/api/">GeoServer REST API</a>
 */
@Component
public class GeoServerClient {

    private final GeoServerProperties props;
    private RestClient client;

    public GeoServerClient(GeoServerProperties props) {
        this.props = props;
    }

    /**
     * 初始化 RestClient — 设 baseUrl、BasicAuth、默认 JSON Accept
     * <p>
     * baseUrl 示例：http://localhost:8081/geoserver/rest
     */
    @PostConstruct
    void init() {
        this.client = RestClient.builder()
                .baseUrl(props.getUrl() + "/rest")
                .defaultHeaders(headers -> {
                    headers.setBasicAuth(props.getUsername(), props.getPassword());
                    headers.set(ACCEPT, APPLICATION_JSON_VALUE);
                })
                // 统一错误处理：4xx / 5xx 直接抛 RuntimeException，由 GlobalExceptionHandler 兜底
                .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
                    throw new RuntimeException(
                            "GeoServer 请求失败: " + res.getStatusCode() + " " + req.getURI());
                })
                .build();
    }

    // ── HTTP 方法封装 ──────────────────────────────────────────

    /**
     * GET 请求，反序列化为指定类型
     *
     * @param path         相对路径（如 /workspaces.json）
     * @param responseType 反序列化目标类型
     * @param <T>          响应类型泛型
     * @return 反序列化后的对象
     */
    public <T> T get(String path, Class<T> responseType) {
        return client.get()
                .uri(path)
                .retrieve()
                .body(responseType);
    }

    /**
     * POST 请求，发送 JSON body，返回反序列化结果
     *
     * @param path         相对路径
     * @param body         请求体（会被 Jackson 序列化）
     * @param responseType 响应反序列化类型
     * @param <T>          响应类型泛型
     * @return 反序列化后的对象
     */
    public <T> T post(String path, Object body, Class<T> responseType) {
        return client.post()
                .uri(path)
                .body(body)
                .retrieve()
                .body(responseType);
    }

    /**
     * PUT 请求，发送 JSON body，返回反序列化结果
     *
     * @param path         相对路径
     * @param body         请求体
     * @param responseType 响应反序列化类型
     * @param <T>          响应类型泛型
     * @return 反序列化后的对象
     */
    public <T> T put(String path, Object body, Class<T> responseType) {
        return client.put()
                .uri(path)
                .body(body)
                .retrieve()
                .body(responseType);
    }

    /**
     * DELETE 请求
     *
     * @param path 相对路径
     */
    public void delete(String path) {
        client.delete()
                .uri(path)
                .retrieve()
                .body(Void.class);
    }

    /** 获取配置（供 Service 读取默认 workspace 等） */
    public GeoServerProperties props() {
        return props;
    }
}
