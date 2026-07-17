package com.webgis.spatial.dto;

/**
 * 空间表列表响应 VO — 对应 layer_catalog 中的一条记录
 */
public class SpatialTableVO {

    private Long id;
    /** 显示名称（layer_catalog.name） */
    private String name;
    /** 物理表名（public schema 中的表） */
    private String tableName;
    /** 几何类型: POINT / LINE / POLYGON / GEOMETRY */
    private String geometryType;
    /** 几何字段名（通常为 geom） */
    private String geomColumn;
    /** SRID */
    private Integer srid;
    /** 描述 */
    private String description;
    /** 估算行数 */
    private Long rowCount;
    /** 主键列名（如 gid） */
    private String rowKeyColumn;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTableName() { return tableName; }
    public void setTableName(String tableName) { this.tableName = tableName; }

    public String getGeometryType() { return geometryType; }
    public void setGeometryType(String geometryType) { this.geometryType = geometryType; }

    public String getGeomColumn() { return geomColumn; }
    public void setGeomColumn(String geomColumn) { this.geomColumn = geomColumn; }

    public Integer getSrid() { return srid; }
    public void setSrid(Integer srid) { this.srid = srid; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getRowCount() { return rowCount; }
    public void setRowCount(Long rowCount) { this.rowCount = rowCount; }

    public String getRowKeyColumn() { return rowKeyColumn; }
    public void setRowKeyColumn(String rowKeyColumn) { this.rowKeyColumn = rowKeyColumn; }
}
