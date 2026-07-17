package com.webgis.spatial.dto;

/**
 * 空间数据查询请求
 */
public class DataQueryRequest {

    /** 物理表名 */
    private String tableName;
    /** 几何字段名 */
    private String geomColumn;
    /** 页码（从 1 开始） */
    private int pageNum = 1;
    /** 每页条数 */
    private int pageSize = 50;
    /** 搜索关键词（为空时返回全部） */
    private String keyword;

    public String getTableName() { return tableName; }
    public void setTableName(String tableName) { this.tableName = tableName; }

    public String getGeomColumn() { return geomColumn; }
    public void setGeomColumn(String geomColumn) { this.geomColumn = geomColumn; }

    public int getPageNum() { return pageNum; }
    public void setPageNum(int pageNum) { this.pageNum = pageNum; }

    public int getPageSize() { return pageSize; }
    public void setPageSize(int pageSize) { this.pageSize = pageSize; }

    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
}
