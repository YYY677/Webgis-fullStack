package com.webgis.geoserver.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * SLD 样式可编辑参数 — 前后端唯一约定的数据模型
 * <p>
 * 每个 Rule（点/线/面）对应一个 MapStyle，前端表单编辑此对象的字段，
 * 保存时后端通过 DOM+XPath 只修改 SLD XML 中对应的节点。
 */
@Data
public class MapStyle {
    /** 几何类型: "POINT" | "LINE" | "POLYGON" | "RASTER" */
    private String geomType;
    /** Rule/Name — SldModifier 定位 Rule 的查找钥匙，前端不可编辑 */
    private String name;
    /** UserStyle/Abstract — 样式描述 */
    private String description;
    /** Rule/Title — 图例显示名 */
    private String legendTitle;

    // ── 填充 ───────────────────────────────────────────────────
    private String fillcolor;
    private String fillopacity;

    // ── 边框/线条 ─────────────────────────────────────────────
    private String bordercolor;
    private String borderwidth;
    private String borderopacity;

    // ── 栅格 ──────────────────────────────────────────────────
    private String opacity;       // RasterSymbolizer/Opacity

    /** ColorMap 条目列表：每项 {color, quantity, label?} */
    private List<Map<String, String>> colorMapEntries;

    // ── 点 ─────────────────────────────────────────────────────
    private String size;
    private String markname;      // WellKnownName: circle/square/triangle/star/cross/x
    private String rotation;

    // ── 线 ─────────────────────────────────────────────────────
    private String dash;          // stroke-dasharray
}
