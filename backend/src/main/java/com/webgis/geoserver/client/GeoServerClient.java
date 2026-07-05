package com.webgis.geoserver.client;

import com.webgis.geoserver.config.GeoServerProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static org.springframework.http.HttpHeaders.ACCEPT;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * GeoServer REST API 客户端 — 基于 Spring WebClient
 *
 * 封装了基本认证、路径拼接、错误处理，供各 Service 调用。
 * GeoServer REST API 文档参考: https://docs.geoserver.org/stable/en/api/
 */
@Component
public class GeoServerClient {

    private final GeoServerProperties props;
    private WebClient client;

    public GeoServerClient(GeoServerProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        this.client = WebClient.builder()
                .baseUrl(props.getUrl() + "/rest")
                .defaultHeaders(headers -> {
                    headers.setBasicAuth(props.getUsername(), props.getPassword());
                    headers.set(ACCEPT, APPLICATION_JSON_VALUE);
                })
                .build();
    }

    // ── HTTP 方法封装 ──────────────────────────────────────────

    public <T> Mono<T> get(String path, Class<T> responseType) {
        return client.get()
                .uri(path)
                .retrieve()
                .bodyToMono(responseType);
    }

    public <T> Mono<T> post(String path, Object body, Class<T> responseType) {
        return client.post()
                .uri(path)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(responseType);
    }

    public <T> Mono<T> put(String path, Object body, Class<T> responseType) {
        return client.put()
                .uri(path)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(responseType);
    }

    public Mono<Void> delete(String path) {
        return client.delete()
                .uri(path)
                .retrieve()
                .bodyToMono(Void.class);
    }

    /** 获取配置（供 Service 读取默认 workspace 等） */
    public GeoServerProperties props() { return props; }
}
