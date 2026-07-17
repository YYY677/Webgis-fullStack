package com.webgis.spatial.dto;

import java.util.Map;

/**
 * 行数据增/改/删请求
 */
public class RowSaveRequest {

    /** 物理表名 */
    private String tableName;
    /** 几何字段名 */
    private String geomColumn;
    /** 主键列名（如 gid） */
    private String rowKeyColumn;
    /** 主键值 */
    private Object rowKeyValue;
    /** 行数据（key=字段名, value=值） */
    private Map<String, Object> newRow;
    /** 字段列表 */
    private String[] fields;
    /** WKT 几何值（新增/更新时使用） */
    private String wkt;

    public String getTableName() { return tableName; }
    public void setTableName(String tableName) { this.tableName = tableName; }

    public String getGeomColumn() { return geomColumn; }
    public void setGeomColumn(String geomColumn) { this.geomColumn = geomColumn; }

    public String getRowKeyColumn() { return rowKeyColumn; }
    public void setRowKeyColumn(String rowKeyColumn) { this.rowKeyColumn = rowKeyColumn; }

    public Object getRowKeyValue() { return rowKeyValue; }
    public void setRowKeyValue(Object rowKeyValue) { this.rowKeyValue = rowKeyValue; }

    public Map<String, Object> getNewRow() { return newRow; }
    public void setNewRow(Map<String, Object> newRow) { this.newRow = newRow; }

    public String[] getFields() { return fields; }
    public void setFields(String[] fields) { this.fields = fields; }

    public String getWkt() { return wkt; }
    public void setWkt(String wkt) { this.wkt = wkt; }
}
