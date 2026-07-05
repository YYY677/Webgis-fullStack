package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.WorkspaceInfo;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 工作空间管理 — GET 列表 / POST 创建
 */
@Service
public class WorkspaceService {

    private final GeoServerClient client;

    public WorkspaceService(GeoServerClient client) {
        this.client = client;
    }

    /**
     * 获取所有工作空间
     * GeoServer 返回:
     * { "workspaces": { "workspace": [{ "name": "webgis", "href": "..." }] } }
     */
    @SuppressWarnings("unchecked")
    public Mono<List<WorkspaceInfo>> list() {
        return client.get("/workspaces.json", Map.class)
                .map(root -> {
                    Map<String, Object> workspaces = (Map<String, Object>) root.get("workspaces");
                    if (workspaces == null) return List.<WorkspaceInfo>of();
                    Object wsList = workspaces.get("workspace");
                    if (wsList == null) return List.<WorkspaceInfo>of();

                    // 单个工作空间返回对象，多个返回数组
                    List<Map<String, Object>> items = normalizeList(wsList);
                    return items.stream()
                            .map(m -> new WorkspaceInfo(
                                    (String) m.get("name"),
                                    (String) m.get("href")))
                            .toList();
                });
    }

    /**
     * 创建新工作空间
     * POST /rest/workspaces
     * Body: { "workspace": { "name": "xxx" } }
     */
    public Mono<String> create(String name) {
        Map<String, Object> body = Map.of("workspace", Map.of("name", name));
        return client.post("/workspaces.json", body, String.class);
    }

    /** GeoServer 单条返回 Object，多条返回 List<Object>，统一转成 List */
    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> normalizeList(Object raw) {
        if (raw instanceof List) return (List<Map<String, Object>>) raw;
        return List.of((Map<String, Object>) raw);
    }
}
