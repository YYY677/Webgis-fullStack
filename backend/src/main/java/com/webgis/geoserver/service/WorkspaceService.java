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
    // Mono<List<WorkspaceInfo>>（响应式编程中的“未来单值”，代表异步执行后最终会返回一个 List<WorkspaceInfo>）
    @SuppressWarnings("unchecked")
    public Mono<List<WorkspaceInfo>> list() {

        // 第一步：client.get("/workspaces.json", Map.class) —— 拿到整个 JSON 对象
        // 执行后返回的 root 是一个 Map<String, Object>，完整地装下了整个 JSON 字符串。
        // "http://localhost:8081/geoserver/rest/workspaces.json"
        //{
        //  "workspaces": { ... }   // 👈 根对象里只有一个键：workspaces
        //}
        return client.get("/workspaces.json", Map.class)
                //map 是 Reactor 的操作符，map提前告诉 Reactor：“等未来数据到了，请务必执行这个转换逻辑。”
                .map(root -> {

                    // 第二步：root.get("workspaces") —— 剥开第一层
                    // workspaces 是一个 Map<String, Object>，里面有一个键 workspace
                    // {
                    //  "workspace": [ ... ]   // 👈 这个 Map 里只有一个键：workspace
                    //}
                    Map<String, Object> workspaces = (Map<String, Object>) root.get("workspaces");
                    if (workspaces == null) return List.<WorkspaceInfo>of();

                    // 第三步：workspaces.get("workspace") —— 剥开第二层
                    // workspace 是一个 List<Map<String, Object>>，每个 Map 里有 name 和 href
                    // [
                    //  {"name":"Yuu","href":"..."},
                    //  {"name":"cite","href":"..."},
                    //  ...
                    //]
                    Object wsList = workspaces.get("workspace");
                    if (wsList == null) return List.<WorkspaceInfo>of();

                    // 单个工作空间返回对象，多个返回数组
                    List<Map<String, Object>> items = normalizeList(wsList);
                    return items.stream()
                            // 这个map和上面的map不是同一个，前面是Mono的map，这个是Stream的map，负责遍历。
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
        if (raw instanceof List) return (List<Map<String, Object>>) raw; // 👈 是数组，直接返回
        return List.of((Map<String, Object>) raw); // 👈 是单个对象，包装成列表
    }
}
