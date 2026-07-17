package com.webgis.spatial.service;

import com.webgis.spatial.dto.*;
import com.webgis.spatial.mapper.SpatialMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 空间数据 CRUD 业务逻辑
 * <p>
 * 所有 tableName 均经过 layer_catalog 白名单校验，防止 SQL 注入。
 */
@Service
public class SpatialDataService {

    private static final Logger log = LoggerFactory.getLogger(SpatialDataService.class);

    private final SpatialMapper spatialMapper;

    public SpatialDataService(SpatialMapper spatialMapper) {
        this.spatialMapper = spatialMapper;
    }

    /**
     * 获取所有已注册的空间表列表
     */
    public List<SpatialTableVO> listTables() {
        List<Map<String, Object>> catalogRows = spatialMapper.getCatalogTables();
        List<SpatialTableVO> result = new ArrayList<>();

        for (Map<String, Object> row : catalogRows) {
            SpatialTableVO vo = new SpatialTableVO();
            vo.setId(toLong(row.get("id")));
            vo.setName(str(row.get("name")));
            vo.setTableName(str(row.get("tableName")));
            vo.setGeometryType(str(row.get("geometryType")));
            vo.setSrid(row.get("srid") != null ? toInt(row.get("srid")) : 4326);
            vo.setDescription(str(row.get("description")));

            // 查询 geometry 字段名
            // 从information_schema元数据中查询目标表的几何列名
            String geomCol = spatialMapper.findGeomColumn(vo.getTableName());
            vo.setGeomColumn(geomCol != null ? geomCol : "geom");

            // 估算行数
            Long count = spatialMapper.getRowCount(vo.getTableName());
            vo.setRowCount(count != null ? count : 0L);

            // 主键列名
            String pk = spatialMapper.findPrimaryKey(vo.getTableName());
            vo.setRowKeyColumn(pk != null ? pk : "gid");

            result.add(vo);
        }
        return result;
    }

    /**
     * 获取指定表的字段列表
     */
    public List<FieldInfoVO> getFields(String tableName) {
        validateTableName(tableName);
        List<Map<String, Object>> raw = spatialMapper.getFields(tableName);
        String pkColumn = spatialMapper.findPrimaryKey(tableName);
        return raw.stream()
                .map(m -> new FieldInfoVO(
                        str(m.get("name")),
                        str(m.get("type")),
                        Boolean.TRUE.equals(m.get("isGeom")),
                        str(m.get("name")).equals(pkColumn)))
                .collect(Collectors.toList());
    }

    /**
     * 分页查询表数据
     */
    public PageResultVO getTableData(String tableName, int page, int size) {
        validateTableName(tableName);

        String geomColumn = spatialMapper.findGeomColumn(tableName);
        if (geomColumn == null) {
            throw new IllegalArgumentException("表 " + tableName + " 无 geometry 字段");
        }

        int offset = (page - 1) * size;
        List<Map<String, Object>> rows = spatialMapper.selectPage(tableName, geomColumn, offset, size);

        long total = 0;
        if (!rows.isEmpty()) {
            Object rawTotal = rows.get(0).get("total");
            total = rawTotal != null ? toLong(rawTotal) : 0L;
        }

        // 过滤 geometry 二进制字段（只留业务字段 + wkt）
        List<Map<String, Object>> rawFields = spatialMapper.getFields(tableName);
        String pkColumn = spatialMapper.findPrimaryKey(tableName);
        List<FieldInfoVO> fieldVOs = rawFields.stream()
                .map(m -> new FieldInfoVO(
                        str(m.get("name")),
                        str(m.get("type")),
                        Boolean.TRUE.equals(m.get("isGeom")),
                        str(m.get("name")).equals(pkColumn)))
                .filter(f -> !f.isGeom())
                .collect(Collectors.toList());
        // 追加 wkt 虚拟字段
        fieldVOs.add(new FieldInfoVO("wkt", "text", false, false));

        PageResultVO result = new PageResultVO();
        result.setRows(rows);
        result.setFields(fieldVOs);
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * 全字段模糊搜索
     */
    public PageResultVO searchTableData(String tableName, String keyword, int page, int size) {
        validateTableName(tableName);

        String geomColumn = spatialMapper.findGeomColumn(tableName);
        if (geomColumn == null) {
            throw new IllegalArgumentException("表 " + tableName + " 无 geometry 字段");
        }

        // 获取可搜索的字段（非 geometry 字段）
        List<Map<String, Object>> rawFields = spatialMapper.getFields(tableName);
        String[] searchFields = rawFields.stream()
                .filter(m -> !Boolean.TRUE.equals(m.get("isGeom")))
                .map(m -> str(m.get("name")))
                .toArray(String[]::new);

        if (searchFields.length == 0) {
            return new PageResultVO();
        }
        String pkColumn = spatialMapper.findPrimaryKey(tableName);

        int offset = (page - 1) * size;
        List<Map<String, Object>> rows = spatialMapper.searchPage(
                tableName, geomColumn, searchFields, keyword, offset, size);

        long total = 0;
        if (!rows.isEmpty()) {
            Object rawTotal = rows.get(0).get("total");
            total = rawTotal != null ? toLong(rawTotal) : 0L;
        }

        List<FieldInfoVO> fieldVOs = rawFields.stream()
                .map(m -> new FieldInfoVO(
                        str(m.get("name")),
                        str(m.get("type")),
                        Boolean.TRUE.equals(m.get("isGeom")),
                        str(m.get("name")).equals(pkColumn)))
                .filter(f -> !f.isGeom())
                .collect(Collectors.toList());
        fieldVOs.add(new FieldInfoVO("wkt", "text", false, false));

        PageResultVO result = new PageResultVO();
        result.setRows(rows);
        result.setFields(fieldVOs);
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    /**
     * 新增一行
     */
    public void addRow(String tableName, RowSaveRequest dto) {
        validateTableName(tableName);

        String geomColumn = spatialMapper.findGeomColumn(tableName);
        if (geomColumn == null) {
            throw new IllegalArgumentException("表 " + tableName + " 无 geometry 字段");
        }

        // 类型转换
        Map<String, Object> row = dto.getNewRow();
        if (row != null) {
            convertNumericFields(row);
        }

        // 排除 wkt 虚拟字段，保留其他全部字段（含 gid 等自增字段由 DB 处理）
        String[] cleanFields = dto.getFields() != null
                ? Arrays.stream(dto.getFields())
                        .filter(f -> !f.equals("wkt"))
                        .toArray(String[]::new)
                : new String[0];

        // 单次写入：属性 + geometry（st_geomfromtext）
        spatialMapper.insertRow(tableName, cleanFields, geomColumn, row, dto.getWkt());
    }

    /**
     * 更新一行
     */
    public void updateRow(String tableName, RowSaveRequest dto) {
        validateTableName(tableName);

        String geomColumn = spatialMapper.findGeomColumn(tableName);
        if (geomColumn == null) {
            throw new IllegalArgumentException("表 " + tableName + " 无 geometry 字段");
        }

        Map<String, Object> row = dto.getNewRow();
        if (row != null) {
            convertNumericFields(row);
        }

        spatialMapper.updateRow(
                tableName, geomColumn, dto.getFields(), row,
                dto.getRowKeyColumn(), dto.getRowKeyValue(),
                dto.getWkt() != null ? dto.getWkt() : "");
    }

    /**
     * 删除一行
     */
    public void deleteRow(String tableName, RowSaveRequest dto) {
        validateTableName(tableName);
        spatialMapper.deleteRow(tableName, dto.getRowKeyColumn(), dto.getRowKeyValue());
    }

    // ── 内部方法 ──────────────────────────────────────────────

    /** 表名白名单校验 */
    private void validateTableName(String tableName) {
        List<String> validNames = spatialMapper.getValidTableNames();
        if (!validNames.contains(tableName)) {
            throw new IllegalArgumentException("表名 '" + tableName + "' 不在 layer_catalog 中");
        }
    }

    /** 将 String 类型的数值字段转为 Double，避免 PostgreSQL 类型不匹配 */
    private void convertNumericFields(Map<String, Object> row) {
        if (row == null) return;
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            Object val = entry.getValue();
            if (val instanceof String s) {
                if (s.startsWith("POINT") || s.startsWith("LINESTRING")
                        || s.startsWith("POLYGON") || s.startsWith("MULTI")
                        || s.startsWith("GEOMETRY")) {
                    continue;
                }
                try {
                    entry.setValue(Double.parseDouble(s));
                } catch (NumberFormatException ignored) {
                    // 不是数字，保持原字符串
                }
            }
        }
    }

    private static String str(Object o) {
        return o != null ? o.toString() : null;
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        return Long.parseLong(o.toString());
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        return Integer.parseInt(o.toString());
    }
}
