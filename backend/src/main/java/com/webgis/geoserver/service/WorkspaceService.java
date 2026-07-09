package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.WorkspaceInfo;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 工作空间管理 — GET 列表 / POST 创建
 * <p>
 * GeoServer 把工作空间类比为"命名空间"，一个 workspace 下挂 dataStore → featureType → layer。
 */
@Service
public class WorkspaceService {

    private final GeoServerClient client;

    public WorkspaceService(GeoServerClient client) {
        this.client = client;
    }

    // ── 列表 ──────────────────────────────────────────────────

    /**
     * http://localhost:8081/geoserver/rest/workspaces.json
     * 获取所有工作空间
     * <p>
     * GET /rest/workspaces.json
     * <p>
     * GeoServer 实际返回：
     * <pre>{@code
     * { "workspaces": { "workspace": [
     *     { "name": "webgis", "href": "http://..." }
     * ] } }
     * }</pre>
     * 注意：单个 workspace 返回 Object，多个返回 List&lt;Object&gt;。
     */
    @SuppressWarnings("unchecked")
    public List<WorkspaceInfo> list() {
        Map<String, Object> root = client.get("/workspaces.json", Map.class);
        // 空数据时 GeoServer 可能返回 {"workspaces":""}
        Object rawWS = root.get("workspaces");
        // rawWS instanceof Map<?, ?> workspaces 表示如果rawWS是Map类型，则将其赋值给workspaces变量
        if (!(rawWS instanceof Map<?, ?> workspaces)) {
            return List.of();
        }
        if (workspaces.get("workspace") == null) {
            return List.of();
        }
        List<Map<String, Object>> items = normalizeList(workspaces.get("workspace"));
        // .stream() —— 开启传送带，把一整箱原材料（List）倒到传送带（Stream）上。
        // .map(...) —— 传送带上的每个原材料（Map）经过加工，变成新的产品（WorkspaceInfo）。
        // .toList() —— 把传送带上的所有新产品收集，装进一个新的箱子（List）,最终得到了一个 List<WorkspaceInfo>
        return items.stream()
                .map(m -> new WorkspaceInfo(
                        m.get("name") != null ? m.get("name").toString() : null,
                        m.get("href") != null ? m.get("href").toString() : null))
                .toList();
    }

    // ── 创建 ──────────────────────────────────────────────────

    /**
     * 创建新工作空间
     * <p>
     * POST /rest/workspaces.json
     * Body: { "workspace": { "name": "xxx" } }
     */
    public String create(String name) {
        Map<String, Object> body = Map.of("workspace", Map.of("name", name));
        return client.post("/workspaces.json", body, String.class);
    }

    // ── 删除 ──────────────────────────────────────────────────

    /**
     * 删除工作空间及其所有关联资源
     * <p>
     * DELETE /rest/workspaces/{name}.json?recurse=true
     */
    public void delete(String name) {
        client.delete("/workspaces/" + name + ".json?recurse=true");
    }

    // ── 工具方法 ──────────────────────────────────────────────

    /**
     * GeoServer REST API 在返回单个条目时给对象、多个条目时给数组，
     * 此处统一转成 List 方便后续 stream 操作。
     */
    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> normalizeList(Object raw) {
        if (raw instanceof List) {
            return (List<Map<String, Object>>) raw;
        }
        return List.of((Map<String, Object>) raw);
    }
}
