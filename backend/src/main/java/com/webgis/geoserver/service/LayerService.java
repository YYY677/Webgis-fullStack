package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.LayerInfo;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 图层发布管理 — GET 列表 / POST 发布
 * <p>
 * Layer 是"已经发布的地图服务"（WMS / WFS）。
 * 前端通过 LayerInfo 列表选取要叠加到地图的图层。
 */
@Service
public class LayerService {

    private final GeoServerClient client;

    public LayerService(GeoServerClient client) {
        this.client = client;
    }

    // ── 列表 ──────────────────────────────────────────────────

    /**
     * 获取所有已发布的 WMS 图层（可选按 workspace 过滤）
     * <p>
     * GET /rest/layers.json
     * <p>
     * GeoServer 实际返回：
     * <pre>{@code
     * { "layers": { "layer": [
     *     { "name": "webgistest:port", "href": "http://..." }
     * ] } }
     * }</pre>
     * 注意：列表接口只返回 name + href，不含 type / defaultStyle。
     * <p>
     * 过滤逻辑：如果指定了 workspace，只保留 name 以 "{workspace}:" 开头的图层。
     * 因为 /layers.json 不是 workspace 级别的端点，返回全站图层。
     */
    @SuppressWarnings("unchecked")
    public List<LayerInfo> list(String workspace) {
        Map<String, Object> root = client.get("/layers.json", Map.class);
        // 空数据时 GeoServer 可能返回 {"layers":""}
        Object rawLayers = root.get("layers");
        if (!(rawLayers instanceof Map<?, ?> layers)) {
            return List.of();
        }
        if (layers.get("layer") == null) {
            return List.of();
        }

        // 按 workspace 过滤（图层名格式为 "workspace:layerName"）
        return WorkspaceService.normalizeList(layers.get("layer")).stream()
                // 这个 filter 的作用：按工作空间过滤图层列表。
                // 条件	                场景	            结果
                // workspace == null	前端没传 ws 参数	不过滤，返回全部
                // workspace.isEmpty()	前端传了空字符串	同上
                // n.startsWith(workspace + ":")	图层名前缀匹配指定工作空间	只保留该 ws 的图层
                .filter(m -> {
                    String n = m.get("name") != null ? m.get("name").toString() : "";
                    return workspace == null || workspace.isEmpty() || n.startsWith(workspace + ":");
                })
                .map(m -> new LayerInfo(
                        m.get("name") != null ? m.get("name").toString() : null,
                        m.get("href") != null ? m.get("href").toString() : null))
                .toList();
    }

    // ── 发布 ──────────────────────────────────────────────────

    /**
     * 将要素类型（FeatureType）发布为 WMS / WFS 图层
     * <p>
     * POST /rest/workspaces/{ws}/datastores/{ds}/featuretypes.json
     */
    public String publish(String workspace, String datastore, String featureType) {
        Map<String, Object> body = Map.of("featureType", Map.of("name", featureType));
        return client.post(
                "/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes.json",
                body,
                String.class);
    }

    // ── 详情 ──────────────────────────────────────────────────

    /**
     * 获取图层详细信息（类型 / 样式 / 资源 / 创建日期）
     * <p>
     * GET /rest/layers/{name}.json
     * <p>
     * 图层名含冒号（如 webgistest:port），RestClient 自动 URL 编码。
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDetail(String name) {
        return client.get("/layers/" + name + ".json", Map.class);
    }
}
