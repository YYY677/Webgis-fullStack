package com.webgis.geoserver.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 工作空间 — 对应 GeoServer GET /rest/workspaces 返回的摘要条目
 * <p>
 * 实际 API 返回示例：
 * <pre>{@code
 * {"workspaces":{"workspace":[{"name":"webgis","href":"http://..."}]}}
 * }</pre>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceInfo {
    private String name;
    private String href;
}
