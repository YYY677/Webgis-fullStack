package com.webgis.geoserver.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 已发布图层 — 对应 GeoServer GET /rest/layers 返回的摘要条目
 * <p>
 * 实际 API 返回示例：
 * <pre>{@code
 * {"layers":{"layer":[{"name":"webgistest:port","href":"http://..."}]}}
 * }</pre>
 * 注意：列表接口只返回 name + href，type / defaultStyle 在 detail 接口里。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LayerInfo {
    private String name;
    private String href;
}
