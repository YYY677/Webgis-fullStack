package com.webgis.geoserver.dto;

/**
 * 工作空间摘要 DTO — 对应 GeoServer REST API 的 /workspaces 响应
 */
public class WorkspaceInfo {

    private String name;
    private String href;

    public WorkspaceInfo() {}

    public WorkspaceInfo(String name, String href) {
        this.name = name;
        this.href = href;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getHref() { return href; }
    public void setHref(String href) { this.href = href; }
}
