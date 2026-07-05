package com.webgis.geoserver.dto;

/**
 * 要素类型（图层数据源）摘要 DTO — 对应 GeoServer
 * /workspaces/{ws}/datastores/{ds}/featuretypes 响应
 */
public class FeatureTypeInfo {

    private String name;
    private String title;
    private String nativeName;     // 数据库中的实际表名
    private String nativeBoundingBox;

    public FeatureTypeInfo() {}

    public FeatureTypeInfo(String name, String title, String nativeName) {
        this.name = name;
        this.title = title;
        this.nativeName = nativeName;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getNativeName() { return nativeName; }
    public void setNativeName(String nativeName) { this.nativeName = nativeName; }

    public String getNativeBoundingBox() { return nativeBoundingBox; }
    public void setNativeBoundingBox(String nativeBoundingBox) { this.nativeBoundingBox = nativeBoundingBox; }
}
