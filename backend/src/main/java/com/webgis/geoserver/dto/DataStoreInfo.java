package com.webgis.geoserver.dto;

/**
 * 数据存储摘要 DTO — 对应 GeoServer /workspaces/{ws}/datastores 响应
 */
public class DataStoreInfo {

    private String name;
    private String type;           // 如 PostGIS、Shapefile
    private String href;
    private String workspaceName;

    public DataStoreInfo() {}

    public DataStoreInfo(String name, String type, String href) {
        this.name = name;
        this.type = type;
        this.href = href;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getHref() { return href; }
    public void setHref(String href) { this.href = href; }

    public String getWorkspaceName() { return workspaceName; }
    public void setWorkspaceName(String workspaceName) { this.workspaceName = workspaceName; }
}
