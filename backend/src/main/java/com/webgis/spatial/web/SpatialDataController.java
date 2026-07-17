package com.webgis.spatial.web;

import com.webgis.common.Result;
import com.webgis.spatial.dto.*;
import com.webgis.spatial.service.SpatialDataService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 空间数据 CRUD 接口 — 直接读写 PostGIS 空间表，替代 WFS-T
 * <p>
 * 所有表名均经过 layer_catalog 白名单校验。
 */
@RestController
@RequestMapping("/api/spatial")
public class SpatialDataController {

    private final SpatialDataService spatialDataService;

    public SpatialDataController(SpatialDataService spatialDataService) {
        this.spatialDataService = spatialDataService;
    }

    /** 获取所有已注册的空间表列表 */
    @GetMapping("/tables")
    public Result<List<SpatialTableVO>> listTables() {
        return Result.success(spatialDataService.listTables());
    }

    /** 获取指定表的字段列表 */
    @GetMapping("/data/{tableName}/fields")
    public Result<List<FieldInfoVO>> getFields(@PathVariable String tableName) {
        return Result.success(spatialDataService.getFields(tableName));
    }

    /** 分页查询表数据 */
    @GetMapping("/data/{tableName}")
    public Result<PageResultVO> getTableData(
            @PathVariable String tableName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return Result.success(spatialDataService.getTableData(tableName, page, size));
    }

    /** 全字段模糊搜索 */
    @GetMapping("/data/{tableName}/search")
    public Result<PageResultVO> searchTableData(
            @PathVariable String tableName,
            @RequestParam String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return Result.success(spatialDataService.searchTableData(tableName, q, page, size));
    }

    /** 新增一行 */
    @PostMapping("/data/{tableName}/row")
    public Result<Void> addRow(
            @PathVariable String tableName,
            @RequestBody RowSaveRequest dto) {
        dto.setTableName(tableName);
        spatialDataService.addRow(tableName, dto);
        return Result.success();
    }

    /** 更新一行 */
    @PutMapping("/data/{tableName}/row")
    public Result<Void> updateRow(
            @PathVariable String tableName,
            @RequestBody RowSaveRequest dto) {
        dto.setTableName(tableName);
        spatialDataService.updateRow(tableName, dto);
        return Result.success();
    }

    /** 删除一行 */
    @DeleteMapping("/data/{tableName}/row")
    public Result<Void> deleteRow(
            @PathVariable String tableName,
            @RequestBody RowSaveRequest dto) {
        dto.setTableName(tableName);
        spatialDataService.deleteRow(tableName, dto);
        return Result.success();
    }
}
