package com.webgis.geoserver.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 数据存储 — 对应 GeoServer GET /rest/workspaces/{ws}/datastores 返回的摘要条目
 * <p>
 * 实际 API 返回示例：
 * <pre>{@code
 * {"dataStores":{"dataStore":[{"name":"pg-webgistest","href":"http://..."}]}}
 * }</pre>
 * 注意：列表接口只返回 name + href，没有 type 字段（type 在 detail 接口里）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DataStoreInfo {
    private String name;
    private String href;
}
