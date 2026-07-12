package com.webgis.geoserver.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 样式 — 对应 GeoServer GET /rest/styles 返回的摘要条目
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StyleInfo {
    private String name;
    private String href;
}
