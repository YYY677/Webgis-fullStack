package com.webgis.geoserver.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 要素类型（原始数据表） — 对应 GeoServer
 * GET /rest/workspaces/{ws}/datastores/{ds}/featuretypes 返回的摘要条目
 * <p>
 * 实际 API 返回示例：
 * <pre>{@code
 * {"featureTypes":{"featureType":[{"name":"capital","href":"http://..."}]}}
 * }</pre>
 * 注意：列表接口只返回 name + href，title / nativeName 在 detail 接口里。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeatureTypeInfo {
    private String name;
    private String href;
}
