package com.webgis.geoserver.dto;

/**
 * 已发布图层摘要 DTO — 对应 GeoServer /layers 响应
 */
public class LayerInfo {

    private String name;                 // 完整图层名，如 webgis:province_border
    private String title;
    private String type;                 // VECTOR / RASTER
    private String defaultStyle;
    private String href;

    public LayerInfo() {}

    public LayerInfo(String name, String title, String type) {
        this.name = name;
        this.title = title;
        this.type = type;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getDefaultStyle() { return defaultStyle; }
    public void setDefaultStyle(String defaultStyle) { this.defaultStyle = defaultStyle; }

    public String getHref() { return href; }
    public void setHref(String href) { this.href = href; }
}
