package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.FeatureTypeInfo;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 要素类型管理 — 列表（已发布/全部）/ 发布 / 删除 / 详情
 * <p>
 * FeatureType 对应数据库中的一张空间表，是"还没发布的原始数据"。
 * 发布到 Layer 之后才能通过 WMS / WFS 访问。
 */
@Service
public class FeatureTypeService {

    private final GeoServerClient client;

    public FeatureTypeService(GeoServerClient client) {
        this.client = client;
    }

    // ── 已发布列表 ────────────────────────────────────────────

    /**
     * 获取已发布的要素类型（只返回 name + href）
     * <p>
     * GET .../featuretypes.json
     */
    @SuppressWarnings("unchecked")
    public List<FeatureTypeInfo> list(String workspace, String datastore) {
        String path = "/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes.json";
        Map<String, Object> root = client.get(path, Map.class);
        Object rawFT = root.get("featureTypes");
        if (!(rawFT instanceof Map<?, ?> ft)) return List.of();
        if (ft.get("featureType") == null) return List.of();
        return WorkspaceService.normalizeList(ft.get("featureType")).stream()
                .map(m -> new FeatureTypeInfo(
                        m.get("name") != null ? m.get("name").toString() : null,
                        m.get("href") != null ? m.get("href").toString() : null))
                .toList();
    }

    // ── 全部表名（含未发布） ──────────────────────────────────

    /**
     * 获取数据库中所有空间表名（包括未发布的）
     * <p>
     * GET .../featuretypes.json?list=all
     * <p>
     * GeoServer 返回格式:
     * <pre>{@code
     * { "list": { "string": ["capital", "layer_edit", ...] } }
     * }</pre>
     * 这些是数据库里存在但尚未注册为 FeatureType 的表。
     */
    @SuppressWarnings("unchecked")
    public List<String> listAllTableNames(String workspace, String datastore) {
        String path = "/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes.json?list=all";
        Map<String, Object> root = client.get(path, Map.class);
        Object rawList = root.get("list");
        if (!(rawList instanceof Map<?, ?> listMap)) return List.of();
        Object rawStrings = listMap.get("string");
        if (rawStrings instanceof List) return (List<String>) rawStrings;
        if (rawStrings instanceof String s) return List.of(s);
        return List.of();
    }

    // ── 发布 ──────────────────────────────────────────────────

    /**
     * 创建要素类型（发布），GeoServer 自动从数据库检测字段
     * <p>
     * POST .../featuretypes.json
     * <p>
     * 只传最简参数，剩下 GeoServer 自动推断。
     */
    public String publish(String workspace, String datastore, String nativeName, String srs) {
        String path = "/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes.json";
        Map<String, Object> body = Map.of("featureType",
                Map.of("name", nativeName,
                        "nativeName", nativeName,
                        "title", nativeName,
                        "srs", srs != null ? srs : "EPSG:4326",
                        "enabled", true));
        return client.post(path, body, String.class);
    }

    // ── 详情 ──────────────────────────────────────────────────

    /**
     * 获取要素类型详细信息
     * <p>
     * GET .../featuretypes/{name}.json
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDetail(String workspace, String datastore, String name) {
        String path = "/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes/" + name + ".json";
        return client.get(path, Map.class);
    }

    // ── 删除 ──────────────────────────────────────────────────

    /**
     * 删除要素类型
     * <p>
     * DELETE .../featuretypes/{name}.json?recurse=true
     */
    public void delete(String workspace, String datastore, String name) {
        client.delete("/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes/" + name + ".json?recurse=true");
    }
}
