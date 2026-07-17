package com.webgis.spatial.dto;

import java.util.List;
import java.util.Map;

/**
 * 分页数据响应
 */
public class PageResultVO {

    private List<Map<String, Object>> rows;
    private List<FieldInfoVO> fields;
    private long total;
    private int page;
    private int size;

    public List<Map<String, Object>> getRows() { return rows; }
    public void setRows(List<Map<String, Object>> rows) { this.rows = rows; }

    public List<FieldInfoVO> getFields() { return fields; }
    public void setFields(List<FieldInfoVO> fields) { this.fields = fields; }

    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }

    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }
}
