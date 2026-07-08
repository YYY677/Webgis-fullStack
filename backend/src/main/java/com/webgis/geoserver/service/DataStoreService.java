package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.DataStoreInfo;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 数据存储管理 — GET 列表 / POST 创建（PostGIS）
 * <p>
 * 数据存储（DataStore）定义了 GeoServer 如何连接数据库。
 * 一个工作空间可以挂多个数据存储，每个存储对应一个数据库/schema。
 */
@Service
public class DataStoreService {

    private final GeoServerClient client;

    public DataStoreService(GeoServerClient client) {
        this.client = client;
    }

    // ── 列表 ──────────────────────────────────────────────────

    /**
     * 获取指定工作空间下的所有数据存储
     * <p>
     * GET /rest/workspaces/{ws}/datastores.json
     * <p>
     * GeoServer 实际返回：
     * <pre>{@code
     * { "dataStores": { "dataStore": [
     *     { "name": "pg-webgistest", "href": "http://..." }
     * ] } }
     * }</pre>
     * 注意：列表接口只返回 name + href，不含 type 字段。
     */
    @SuppressWarnings("unchecked")
    public List<DataStoreInfo> list(String workspace) {
        Map<String, Object> root = client.get(
                "/workspaces/" + workspace + "/datastores.json", Map.class);
        // 空数据时 GeoServer 可能返回 {"dataStores":""}（空字符串而非空对象）
        Object rawDS = root.get("dataStores");
        if (!(rawDS instanceof Map<?, ?> ds)) {
            return List.of();
        }
        if (ds.get("dataStore") == null) {
            return List.of();
        }
        return WorkspaceService.normalizeList(ds.get("dataStore")).stream()
                .map(m -> new DataStoreInfo(
                        m.get("name") != null ? m.get("name").toString() : null,
                        m.get("href") != null ? m.get("href").toString() : null))
                .toList();
    }

    // ── 创建（PostGIS）────────────────────────────────────────

    /**
     * 创建一个指向 PostGIS 数据库的数据存储
     * <p>
     * POST /rest/workspaces/{ws}/datastores.json
     * <p>
     * GeoServer 要求 connectionParameters 用特殊的 {@code entry} 数组格式：
     * <pre>{@code
     * { "dataStore": {
     *     "name": "my_pg",
     *     "connectionParameters": {
     *       "entry": [
     *         { "@key": "dbtype", "$": "postgis" },
     *         { "@key": "host",   "$": "localhost" },
     *         { "@key": "port",   "$": "5432" },
     *         ...
     *       ]
     *     }
     * } }
     * }</pre>
     */
    public String createPostGIS(String workspace, String name,
                                 String host, int port, String database,
                                 String user, String password, String schema) {

        // 构建连接参数 Map，再转成 GeoServer 要求的 entry 格式
        Map<String, Object> connectionParams = Map.of(
                "dbtype", "postgis", "host", host, "port", String.valueOf(port),
                "database", database, "user", user, "passwd", password, "schema", schema);

        Map<String, Object> body = Map.of("dataStore",
                Map.of("name", name,
                        "connectionParameters", Map.of("entry",
                                connectionParams.entrySet().stream()
                                        .map(e -> Map.of("@key", e.getKey(), "$", e.getValue()))
                                        .toList())));

        return client.post("/workspaces/" + workspace + "/datastores.json", body, String.class);
    }

    // ── 详情 ──────────────────────────────────────────────────

    /**
     * 获取数据存储的详细配置信息（连接参数、启用状态等）
     * <p>
     * GET /rest/workspaces/{ws}/datastores/{name}.json
     *
     * @return 原始 JSON 响应（Map），前端自行提取展示字段
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDetail(String workspace, String name) {
        String path = "/workspaces/" + workspace + "/datastores/" + name + ".json";
        return client.get(path, Map.class);
    }

    // ── 删除 ──────────────────────────────────────────────────

    /**
     * 删除数据存储及其关联的要素类型
     * <p>
     * DELETE /rest/workspaces/{ws}/datastores/{name}.json?recurse=true
     */
    public void delete(String workspace, String name) {
        client.delete("/workspaces/" + workspace + "/datastores/" + name + ".json?recurse=true");
    }
}
