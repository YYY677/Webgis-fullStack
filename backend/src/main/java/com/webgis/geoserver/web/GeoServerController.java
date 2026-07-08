package com.webgis.geoserver.web;

import com.webgis.common.Result;
import com.webgis.geoserver.dto.*;
import com.webgis.geoserver.service.*;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * GeoServer 管理接口 — 后端代理转发到 GeoServer REST API
 * <p>
 * 所有响应统一包装为 {@link com.webgis.common.Result} 格式。
 */
@RestController
@RequestMapping("/api/geoserver")
public class GeoServerController {

    private final WorkspaceService workspaceService;
    private final DataStoreService dataStoreService;
    private final FeatureTypeService featureTypeService;
    private final LayerService layerService;
    private final DataUploadService dataUploadService;

    public GeoServerController(WorkspaceService workspaceService,
                                DataStoreService dataStoreService,
                                FeatureTypeService featureTypeService,
                                LayerService layerService,
                                DataUploadService dataUploadService) {
        this.workspaceService = workspaceService;
        this.dataStoreService = dataStoreService;
        this.featureTypeService = featureTypeService;
        this.layerService = layerService;
        this.dataUploadService = dataUploadService;
    }

    // ════════════════════════════════════════════════════════════
    // Workspace
    // ════════════════════════════════════════════════════════════

    @GetMapping("/workspaces")
    public Result<List<WorkspaceInfo>> listWorkspaces() {
        return Result.success(workspaceService.list());
    }

    /**
     * 创建工作空间 + 可选启用服务
     * Body: { "name":"xx", "services":{"wms":true,"wfs":true,"wmts":true,"wcs":true} }
     */
    @PostMapping("/workspaces")
    public Result<String> createWorkspace(@RequestBody Map<String, Object> body) {
        String name = toString(body.get("name"));
        if (name == null || name.isBlank()) return Result.error(400, "name 不能为空");
        workspaceService.create(name);
        return Result.success("工作空间 " + name + " 已创建");
    }

    /** DELETE /api/geoserver/workspaces/{name} — 删除工作空间 */
    @DeleteMapping("/workspaces/{name}")
    public Result<String> deleteWorkspace(@PathVariable String name) {
        workspaceService.delete(name);
        return Result.success("工作空间 " + name + " 已删除");
    }

    // ════════════════════════════════════════════════════════════
    // DataStore
    // ════════════════════════════════════════════════════════════

    @GetMapping("/datastores")
    public Result<List<DataStoreInfo>> listDataStores(@RequestParam("ws") String workspace) {
        return Result.success(dataStoreService.list(workspace));
    }

    @PostMapping("/datastores")
    public Result<String> createDataStore(@RequestBody Map<String, Object> body) {
        String ws = toString(body.get("workspace"));
        String name = toString(body.get("name"));
        String host = toString(body.getOrDefault("host", "localhost"));
        int port = body.containsKey("port") ? ((Number) body.get("port")).intValue() : 5432;
        String database = toString(body.get("database"));
        String user = toString(body.get("user"));
        String password = toString(body.get("password"));
        String schema = toString(body.getOrDefault("schema", "public"));
        if (ws == null || name == null || database == null)
            return Result.error(400, "workspace, name, database 不能为空");
        dataStoreService.createPostGIS(ws, name, host, port, database, user, password, schema);
        return Result.success("数据存储 " + name + " 已创建");
    }

    /** 安全地转 String，null 或非 String 类型都处理 */
    private static String toString(Object o) {
        if (o == null) return null;
        return o.toString();
    }

    /** 数据存储详情 */
    @GetMapping("/datastores/detail")
    public Result<Map<String, Object>> detailDataStore(
            @RequestParam("ws") String workspace,
            @RequestParam("name") String name) {
        return Result.success(dataStoreService.getDetail(workspace, name));
    }

    /** DELETE /api/geoserver/datastores?ws=&name= — 删除数据存储 */
    @DeleteMapping("/datastores")
    public Result<String> deleteDataStore(
            @RequestParam("ws") String workspace,
            @RequestParam("name") String name) {
        dataStoreService.delete(workspace, name);
        return Result.success("数据存储 " + name + " 已删除");
    }

    // ════════════════════════════════════════════════════════════
    // FeatureType
    // ════════════════════════════════════════════════════════════

    /** 已发布的要素类型列表 */
    @GetMapping("/featuretypes")
    public Result<List<FeatureTypeInfo>> listFeatureTypes(
            @RequestParam("ws") String workspace,
            @RequestParam("ds") String datastore) {
        return Result.success(featureTypeService.list(workspace, datastore));
    }

    /** 全部表名（含未发布的） — GET /api/geoserver/featuretypes/all?ws=&ds= */
    @GetMapping("/featuretypes/all")
    public Result<List<String>> listAllFeatureTypes(
            @RequestParam("ws") String workspace,
            @RequestParam("ds") String datastore) {
        return Result.success(featureTypeService.listAllTableNames(workspace, datastore));
    }

    /** 将空间表发布为要素类型 + 图层 */
    @PostMapping("/featuretypes/publish")
    public Result<String> publishFeatureType(@RequestBody Map<String, String> body) {
        String ws = body.get("workspace");
        String ds = body.get("datastore");
        String tableName = body.get("tableName");
        String srs = body.getOrDefault("srs", "EPSG:4326");
        if (ws == null || ds == null || tableName == null)
            return Result.error(400, "workspace, datastore, tableName 不能为空");
        featureTypeService.publish(ws, ds, tableName, srs);
        return Result.success("要素类型 " + tableName + " 已发布");
    }

    /** 要素类型详情 */
    @GetMapping("/featuretypes/detail")
    public Result<Map<String, Object>> detailFeatureType(
            @RequestParam("ws") String workspace,
            @RequestParam("ds") String datastore,
            @RequestParam("name") String name) {
        return Result.success(featureTypeService.getDetail(workspace, datastore, name));
    }

    /** 取消发布（从 GeoServer 移除，保留数据库表） */
    @DeleteMapping("/featuretypes")
    public Result<String> deleteFeatureType(
            @RequestParam("ws") String workspace,
            @RequestParam("ds") String datastore,
            @RequestParam("name") String name) {
        featureTypeService.delete(workspace, datastore, name);
        return Result.success("要素类型 " + name + " 已取消发布");
    }

    /** 从数据库彻底删除（DROP TABLE + 从 GeoServer 移除） */
    @DeleteMapping("/featuretypes/drop")
    public Result<String> dropFeatureType(
            @RequestParam("ws") String workspace,
            @RequestParam("ds") String datastore,
            @RequestParam("name") String name) {
        try {
            dataUploadService.dropTable(name);
            // 如果 GeoServer 上还有注册，也删掉
            try { featureTypeService.delete(workspace, datastore, name); } catch (Exception ignored) {}
            return Result.success("表 " + name + " 已从数据库删除");
        } catch (Exception e) {
            return Result.error(500, "删除失败: " + e.getMessage());
        }
    }

    /** 上传文件创建要素类型（Shapefile zip / 多文件 / GeoJSON） */
    @PostMapping(value = "/featuretypes/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<String> uploadFeatureType(
            @RequestParam("workspace") String workspace,
            @RequestParam("datastore") String datastore,
            @RequestParam("name") String name,
            @RequestParam("format") String format,
            @RequestParam("files") MultipartFile[] files) {
        try {
            if (files == null || files.length == 0) return Result.error(400, "请选择文件");
            if (!List.of("shp", "geojson").contains(format.toLowerCase()))
                return Result.error(400, "格式仅支持 shp / geojson");
            String layerName = dataUploadService.upload(workspace, datastore, name, format, files);
            return Result.success("上传成功: " + layerName);
        } catch (IllegalArgumentException e) {
            return Result.error(400, e.getMessage());
        } catch (Exception e) {
            return Result.error(500, "上传失败: " + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // Layer
    // ════════════════════════════════════════════════════════════

    @GetMapping("/layers")
    public Result<List<LayerInfo>> listLayers(
            @RequestParam(value = "ws", required = false) String workspace) {
        return Result.success(layerService.list(workspace));
    }

    /** 图层详情 */
    @GetMapping("/layers/detail")
    public Result<Map<String, Object>> detailLayer(@RequestParam("name") String name) {
        return Result.success(layerService.getDetail(name));
    }

    /** 将 FeatureType 发布为图层（兼容旧调用） */
    @PostMapping("/layers/publish")
    public Result<String> publishLayer(@RequestBody Map<String, String> body) {
        String ws = body.get("workspace");
        String ds = body.get("datastore");
        String ft = body.get("featureType");
        if (ws == null || ds == null || ft == null)
            return Result.error(400, "workspace, datastore, featureType 不能为空");
        layerService.publish(ws, ds, ft);
        return Result.success("图层 " + ws + ":" + ft + " 已发布");
    }
}
