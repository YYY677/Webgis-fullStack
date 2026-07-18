package com.webgis.spatial.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

/**
 * 空间数据动态 CRUD Mapper — 直接操作 public schema 中的空间表
 * <p>
 * 所有 ${tableName} 均经过 layer_catalog 白名单校验，防止 SQL 注入。
 */
@Mapper
public interface SpatialMapper {

    // ── 元数据查询 ──────────────────────────────────────────

    /** 从 layer_catalog 获取所有已注册的空间表名 */
    List<String> getValidTableNames();

    /** 从 layer_catalog 获取表信息 */
    List<Map<String, Object>> getCatalogTables();

    /** 查询表的 geometry 字段名 */
    String findGeomColumn(@Param("tableName") String tableName);

    /** 查询一个空间表的字段列表 */
    List<Map<String, Object>> getFields(@Param("tableName") String tableName);

    /** 查询表的主键列名 */
    String findPrimaryKey(@Param("tableName") String tableName);

    /** 估算表行数 */
    Long getRowCount(@Param("tableName") String tableName);

    // ── CRUD ────────────────────────────────────────────────

    /** 分页查询 */
    List<Map<String, Object>> selectPage(
            @Param("tableName") String tableName,
            @Param("geomColumn") String geomColumn,
            @Param("offset") int offset,
            @Param("size") int size);

    /** 全字段搜索 */
    List<Map<String, Object>> searchPage(
            @Param("tableName") String tableName,
            @Param("geomColumn") String geomColumn,
            @Param("fields") String[] fields,
            @Param("keyword") String keyword,
            @Param("offset") int offset,
            @Param("size") int size);

    /** 新增一行（含 geometry） */
    int insertRow(
            @Param("tableName") String tableName,
            @Param("fields") String[] fields,
            @Param("geomColumn") String geomColumn,
            @Param("row") Map<String, Object> row,
            @Param("wkt") String wkt);

    /** 更新行属性（按主键匹配） */
    int updateRow(
            @Param("tableName") String tableName,
            @Param("geomColumn") String geomColumn,
            @Param("fields") String[] fields,
            @Param("row") Map<String, Object> row,
            @Param("rowKeyColumn") String rowKeyColumn,
            @Param("rowKeyValue") Object rowKeyValue,
            @Param("wkt") String wkt);

    /** 删除（按主键匹配） */
    int deleteRow(
            @Param("tableName") String tableName,
            @Param("rowKeyColumn") String rowKeyColumn,
            @Param("rowKeyValue") Object rowKeyValue);
}
