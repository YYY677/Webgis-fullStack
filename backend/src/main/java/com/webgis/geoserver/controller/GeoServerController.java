package com.webgis.geoserver.controller;

import com.webgis.common.Result;
import com.webgis.geoserver.dto.*;
import com.webgis.geoserver.service.*;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * GeoServer 管理接口 — 代理转发到 GeoServer REST API
 *
 * 前端通过 /api/geoserver/** 访问，后端转发到 GeoServer 并包装为统一 Result 格式。
 */
@RestController
@RequestMapping("/api/geoserver")
public class GeoServerController {

    private final WorkspaceService workspaceService;
    private final DataStoreService dataStoreService;
    private final FeatureTypeService featureTypeService;
    private final LayerService layerService;

    public GeoServerController(WorkspaceService workspaceService,
                                DataStoreService dataStoreService,
                                FeatureTypeService featureTypeService,
                                LayerService layerService) {
        this.workspaceService = workspaceService;
        this.dataStoreService = dataStoreService;
        this.featureTypeService = featureTypeService;
        this.layerService = layerService;
    }

    // ── Workspace ────────────────────────────────────────────

    /** GET /api/geoserver/workspaces — 工作空间列表 */
    @GetMapping("/workspaces")
    public Mono<Result<List<WorkspaceInfo>>> listWorkspaces() {
        return workspaceService.list().map(Result::success);
    }

    /** POST /api/geoserver/workspaces — 创建工作空间 */
    @PostMapping("/workspaces")
    public Mono<Result<String>> createWorkspace(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return Mono.just(Result.error(400, "name 不能为空"));
        }
        return workspaceService.create(name)
                .map(resp -> Result.success("工作空间 " + name + " 已创建"));
    }

    // ── DataStore ────────────────────────────────────────────

    /** GET /api/geoserver/datastores?ws=xxx — 数据存储列表 */
    @GetMapping("/datastores")
    public Mono<Result<List<DataStoreInfo>>> listDataStores(@RequestParam("ws") String workspace) {
        return dataStoreService.list(workspace).map(Result::success);
    }

    /** POST /api/geoserver/datastores — 创建 PostGIS 数据存储 */
    @PostMapping("/datastores")
    public Mono<Result<String>> createDataStore(@RequestBody Map<String, Object> body) {
        String ws = (String) body.get("workspace");
        String name = (String) body.get("name");
        String host = (String) body.getOrDefault("host", "localhost");
        int port = body.containsKey("port") ? ((Number) body.get("port")).intValue() : 5432;
        String database = (String) body.get("database");
        String user = (String) body.get("user");
        String password = (String) body.get("password");
        String schema = (String) body.getOrDefault("schema", "public");

        if (ws == null || name == null || database == null) {
            return Mono.just(Result.error(400, "workspace, name, database 不能为空"));
        }
        return dataStoreService.createPostGIS(ws, name, host, port, database, user, password, schema)
                .map(resp -> Result.success("数据存储 " + name + " 已创建"));
    }

    // ── FeatureType ──────────────────────────────────────────

    /** GET /api/geoserver/featuretypes?ws=xxx&ds=xxx — 要素类型列表 */
    @GetMapping("/featuretypes")
    public Mono<Result<List<FeatureTypeInfo>>> listFeatureTypes(
            @RequestParam("ws") String workspace,
            @RequestParam("ds") String datastore) {
        return featureTypeService.list(workspace, datastore).map(Result::success);
    }

    // ── Layer ────────────────────────────────────────────────

    /** GET /api/geoserver/layers?ws=xxx — 已发布图层列表 */
    @GetMapping("/layers")
    public Mono<Result<List<LayerInfo>>> listLayers(
            @RequestParam(value = "ws", required = false) String workspace) {
        return layerService.list(workspace).map(Result::success);
    }

    /** POST /api/geoserver/layers/publish — 发布图层 */
    @PostMapping("/layers/publish")
    public Mono<Result<String>> publishLayer(@RequestBody Map<String, String> body) {
        String ws = body.get("workspace");
        String ds = body.get("datastore");
        String ft = body.get("featureType");
        if (ws == null || ds == null || ft == null) {
            return Mono.just(Result.error(400, "workspace, datastore, featureType 不能为空"));
        }
        return layerService.publish(ws, ds, ft)
                .map(resp -> Result.success("图层 " + ws + ":" + ft + " 已发布"));
    }
}
