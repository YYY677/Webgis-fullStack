package com.webgis.geoserver.style;

import com.webgis.geoserver.dto.MapStyle;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import java.io.ByteArrayInputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 基于 DOM + XPath 直接修改 SLD XML 字符串，不经过 GeoTools 对象序列化。
 *
 * <h3>为什么不用 GeoTools？</h3>
 * GeoServer 有自己的 SLD 内部模型（FeatureTypeStyle、Rule 等 Java 对象），
 * 通过 GeoTools 解码 SLD → Java 对象 → 改字段 → 编码回 XML 这条路看似标准，
 * 但实际上 GeoTools 序列化时会重新排布节点、丢弃 VendorOption、
 * 改写命名空间前缀等，破坏原始 SLD 中 UI 不支持的节点。
 *
 * <h3>DOM+XPath 修补策略</h3>
 * 这个类的做法是：
 * <ol>
 * <li>用 DOM 解析原始 SLD XML 为 Document</li>
 * <li>用 XPath 精准定位要改的节点（如 Rule 下的 Fill 颜色）</li>
 * <li>只调 {@code setTextContent()} 改文本，不动周围任何节点</li>
 * <li>序列化回字符串，除目标节点外其余字节原封不动</li>
 * </ol>
 *
 * <p>
 * 这样可以保留 VendorOption、ExternalGraphic、TextSymbolizer、
 * ElseFilter、ContrastEnhancement 等 UI 表单不支持的节点。
 * </p>
 *
 * <h3>与 SldParser 的对称关系</h3>
 * <ul>
 * <li>{@link SldParser} 读 SLD → {@code List<MapStyle>}（解析出可编辑字段）</li>
 * <li>{@code SldModifier} 拿 {@code List<MapStyle>} → 修补 SLD（写回修改后的字段）</li>
 * </ul>
 * 两者共享相同的 XPath 映射表（{@link #POINT_XPATH}、{@link #LINE_XPATH} 等），
 * 确保读和写的节点路径一致。
 */
public class SldModifier {

    /**
     * SLD 命名空间 URI（OGC 标准固定值）。
     * 所有 SLD XML 元素（Rule、PolygonSymbolizer、Fill、CssParameter 等）都归属此命名空间。
     * 不管 XML 中用的是 {@code sld:} 前缀还是默认命名空间 {@code xmlns="..."}，
     * 在 DOM 中 namespaceURI 都是这个值。
     */
    private static final String SLD_NS = "http://www.opengis.net/sld";

    // ── 字段-XPath 映射表（按几何类型分组）─────────────────────────────────
    //
    // 每个映射表的 key 是 MapStyle 的 Java 字段名（如 "fillcolor"），
    // value 是相对于 Rule 节点的 XPath 表达式。
    //
    // SldParser（读）和 SldModifier（写）共用这些映射表，
    // 确保读写的节点路径一致。
    //
    // XPath 中的 "@name='fill'" 是谓词，精确定位特定的 CssParameter 元素，
    // 因为一个 Stroke 下可能同时存在 name='stroke' 和 name='stroke-width' 等。
    // ────────────────────────────────────────────────────────────────

    /** 点符号参数 → XPath（相对于 Rule 节点） */
    private static final Map<String, String> POINT_XPATH = new LinkedHashMap<>();
    /** 线符号参数 → XPath */
    private static final Map<String, String> LINE_XPATH = new LinkedHashMap<>();
    /** 面符号参数 → XPath */
    private static final Map<String, String> POLYGON_XPATH = new LinkedHashMap<>();
    /** 栅格符号参数 → XPath */
    private static final Map<String, String> RASTER_XPATH = new LinkedHashMap<>();

    /**
     * geomType → 字段-XPath 映射表。
     * 用于根据几何类型快速查到该类型有哪些可编辑字段以及它们对应的 XPath。
     */
    private static final Map<String, Map<String, String>> XPATH_MAP = new LinkedHashMap<>();

    /**
     * 初始化 XPath 映射表。
     *
     * 每个几何类型维护一张独立的字段-XPath 映射，因为点/线/面/栅格的
     * SLD 结构完全不同（点有 Graphic/Mark/WellKnownName，面有 Fill 等）。
     *
     * <p>
     * XPath 采用 {@code sld:} 前缀，因为我们的 NamespaceContext
     * 将 {@code sld} 绑定到 {@link #SLD_NS}。不管原始 XML 用什么前缀，
     * 在 DOM 中 namespaceURI 是固定的，XPath 用 {@code sld:} 就能匹配。
     */
    static {
        // ── 点 ──────────────────────────────────────────────────
        POINT_XPATH.put("size", "sld:PointSymbolizer/sld:Graphic/sld:Size");
        POINT_XPATH.put("rotation", "sld:PointSymbolizer/sld:Graphic/sld:Rotation");
        POINT_XPATH.put("markname", "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:WellKnownName");
        POINT_XPATH.put("fillcolor",
                "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:Fill/sld:CssParameter[@name='fill']");
        POINT_XPATH.put("bordercolor",
                "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:Stroke/sld:CssParameter[@name='stroke']");
        POINT_XPATH.put("borderwidth",
                "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:Stroke/sld:CssParameter[@name='stroke-width']");

        // ── 线 ──────────────────────────────────────────────────
        LINE_XPATH.put("bordercolor", "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke']");
        LINE_XPATH.put("borderopacity", "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-opacity']");
        LINE_XPATH.put("borderwidth", "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-width']");
        LINE_XPATH.put("dash", "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-dasharray']");

        // ── 面 ──────────────────────────────────────────────────
        POLYGON_XPATH.put("fillcolor", "sld:PolygonSymbolizer/sld:Fill/sld:CssParameter[@name='fill']");
        POLYGON_XPATH.put("fillopacity", "sld:PolygonSymbolizer/sld:Fill/sld:CssParameter[@name='fill-opacity']");
        POLYGON_XPATH.put("bordercolor", "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke']");
        POLYGON_XPATH.put("borderwidth", "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-width']");
        POLYGON_XPATH.put("borderopacity", "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-opacity']");
        POLYGON_XPATH.put("dash", "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-dasharray']");

        // ── 栅格 ────────────────────────────────────────────────
        RASTER_XPATH.put("opacity", "sld:RasterSymbolizer/sld:Opacity");
        // ColorMap 不在这里配置，因为它涉及多个 ColorMapEntry 子节点的新增/删除，
        // 不能简单地 setTextContent，需要单独在 modify() 中特殊处理。

        // ── 类型 → 映射表 ──────────────────────────────────────
        XPATH_MAP.put("POINT", POINT_XPATH);
        XPATH_MAP.put("LINE", LINE_XPATH);
        XPATH_MAP.put("POLYGON", POLYGON_XPATH);
        XPATH_MAP.put("RASTER", RASTER_XPATH);
    }

    /**
     * 核心方法：拿前端编辑后的参数列表，修补 SLD XML。
     *
     * <h3>工作流程</h3>
     * <ol>
     * <li>解析 SLD XML → DOM Document（{@code setNamespaceAware(true)} 避免命名空间坑）</li>
     * <li>配置 XPath NamespaceContext，绑定 {@code sld} → 标准 OGC SLD URI</li>
     * <li>遍历 {@code mapStyles}（每个 MapStyle 对应 SLD 中的一个 Rule）：</li>
     * <li>用 XPath 按 Rule/Name 定位到 Rule 节点</li>
     * <li>逐字段用 XPath 定位到目标子节点 → {@code setTextContent()}</li>
     * <li>RASTER 类型额外处理 ColorMap（因为 ColorMapEntry 用属性而非文本，需特殊逻辑）</li>
     * <li>序列化 DOM → XML 字符串，返回</li>
     * </ol>
     *
     * <p>
     * 只修改明确指定的节点，其它 XML 内容（包括注释、VendorOption、未知元素）全部原样保留。
     *
     * @param sldXml    GeoServer 返回的原始 SLD XML（纯文本）
     * @param mapStyles 前端回传的编辑后参数列表（每个 Rule 一个 MapStyle）
     * @return 修改后的 SLD XML 字符串
     */
    public static String modify(String sldXml, List<MapStyle> mapStyles) throws Exception {
        // ── Step 1: DOM 解析 ────────────────────────────────────
        // 关键：setNamespaceAware(true) — 不设的话 getNamespaceURI() 返回 null，
        // XPath 的 sld:Rule 等表达式会匹配不到任何节点。
        javax.xml.parsers.DocumentBuilderFactory factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        Document doc = factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(sldXml.getBytes(StandardCharsets.UTF_8)));

        // ── Step 2: XPath 配置 ───────────────────────────────────
        // 自定义 NamespaceContext，让 XPath 中的 "sld:" 前缀匹配
        // http://www.opengis.net/sld 命名空间。
        // XML 文件中可能用默认命名空间 (xmlns="...") 也可能用 sld: 前缀，
        // 但在 DOM 中 namespaceURI 都是这个值，所以 XPath 统一用 sld: 前缀就能匹配。
        XPath xp = XPathFactory.newInstance().newXPath();
        xp.setNamespaceContext(new javax.xml.namespace.NamespaceContext() {
            public String getNamespaceURI(String prefix) {
                return "sld".equals(prefix) ? SLD_NS : null;
            }

            public String getPrefix(String uri) {
                return null;
            }

            public java.util.Iterator<String> getPrefixes(String uri) {
                return null;
            }
        });

        // ── Step 3: 处理样式描述 ──────────────────────────────
        // null 跳过（前端没传），空字符串写空值（用户清空了描述）
        if (!mapStyles.isEmpty()) {
            String desc = mapStyles.get(0).getDescription();
            if (desc != null) // null 跳过（前端没传），空字符串写空值（用户清空了描述）
                setNodeText(xp, doc.getDocumentElement(),
                        "sld:NamedLayer/sld:UserStyle/sld:Abstract", desc);
        }

        // ── Step 4: 遍历每个 Rule 的参数 ─────────────────────────
        for (MapStyle ms : mapStyles) {
            String geomType = ms.getGeomType();
            Map<String, String> fieldXpath = XPATH_MAP.get(geomType);
            if (fieldXpath == null)
                continue; // 未知几何类型，跳过

            String ruleName = ms.getName();
            if (ruleName == null || ruleName.isEmpty())
                throw new IllegalArgumentException("MapStyle 缺少 name 字段，无法定位 Rule");

            // 在 SLD 中用 Rule/Name 定位特定的 Rule 节点
            Element rule = findRuleNode(xp, doc, ruleName);
            if (rule == null)
                throw new IllegalArgumentException(
                        "找不到 Rule [" + ruleName + "]，该 Rule 缺少 Name 和 Title，无法通过表单编辑");

            // ── Step 4a: 图例标题 ──────────────────────────────
            String lt = ms.getLegendTitle();
            if (lt != null) // null 跳过（前端没传），空字符串写空值（用户清空了图例标题）
                setNodeText(xp, rule, "sld:Title", lt);

            // ── Step 4b: 符号参数 ─────────────────────────────
            // null 或 "" → 删除该节点（空标签会导致 GeoServer 渲染失败）
            for (Map.Entry<String, String> entry : fieldXpath.entrySet()) {
                String value = getFieldValue(ms, entry.getKey());
                if (value == null || value.isEmpty())
                    deleteNodePath(rule, entry.getValue());
                else
                    setNodeText(xp, rule, entry.getValue(), value);
            }

            // ── Step 4c: RASTER 特殊处理：ColorMap ──────────────
            // ColorMapEntry 的属性（color/quantity/label）是 XML 属性而非文本节点，
            // 不能用 setNodeText/setTextContent 修改。需要整体删除旧条目+重建新条目。
            if ("RASTER".equals(geomType)) {
                java.util.List<java.util.Map<String, String>> cme = ms.getColorMapEntries();
                if (cme != null && !cme.isEmpty()) {
                    rebuildColorMap(rule, cme, xp);
                }
            }
        }

        // ── Step 5: 序列化 ──────────────────────────────────────
        return serializeXml(doc);
    }

    /**
     * 重建 ColorMap 节点。
     *
     * <p>
     * 为什么不能像其它字段一样直接 setTextContent？
     * ColorMapEntry 的数据存储在 XML 属性中（{@code color="..." quantity="..." label="..."}），
     * 而不是文本节点中。且 ColorMap 的子元素数量可变（可增删分级），
     * 所以需要先清空再全量重建。
     * </p>
     *
     * @param rule    当前 Rule 元素（如 &lt;sld:Rule&gt;）
     * @param entries ColorMap 条目列表，每项包含 color/quantity/label 键
     * @param xp      已配置命名空间的 XPath 对象
     */
    private static void rebuildColorMap(Element rule, java.util.List<java.util.Map<String, String>> entries, XPath xp)
            throws Exception {
        // ── 1. 查找或创建 ColorMap 容器节点 ────────────────────
        // ColorMap 在 SLD 中的路径：Rule > RasterSymbolizer > ColorMap
        NodeList cmList = (NodeList) xp.evaluate("sld:RasterSymbolizer/sld:ColorMap", rule, XPathConstants.NODESET);
        Element colorMap;
        if (cmList.getLength() > 0) {
            colorMap = (Element) cmList.item(0);
        } else {
            // RasterSymbolizer 也不存在？一并创建（极少发生，仅用于骨架 SLD）
            Element rasterSym;
            NodeList rsList = (NodeList) xp.evaluate("sld:RasterSymbolizer", rule, XPathConstants.NODESET);
            if (rsList.getLength() > 0) {
                rasterSym = (Element) rsList.item(0);
            } else {
                rasterSym = rule.getOwnerDocument().createElementNS(SLD_NS, "RasterSymbolizer");
                rule.appendChild(rasterSym);
            }
            colorMap = rule.getOwnerDocument().createElementNS(SLD_NS, "ColorMap");
            rasterSym.appendChild(colorMap);
        }

        // ── 2. 清除现有 ColorMapEntry ───────────────────────────
        // 不断移除第一个，直到没有子ColorMapEntry为止。
        NodeList existing = (NodeList) xp.evaluate("sld:ColorMapEntry", colorMap, XPathConstants.NODESET);
        while (existing.getLength() > 0) {
            colorMap.removeChild(existing.item(0));
            existing = (NodeList) xp.evaluate("sld:ColorMapEntry", colorMap, XPathConstants.NODESET);
        }

        // ── 3. 按前端传入的列表重建 ──────────────────────────
        // 注意：这里是 setAttribute() 不是 setTextContent()，
        // 因为 ColorMapEntry 的 color/quantity 是 XML 属性（attributes），
        // 而不是元素的文本内容（textContent）。
        Document doc = colorMap.getOwnerDocument();
        for (java.util.Map<String, String> entry : entries) {
            org.w3c.dom.Element cmEntry = doc.createElementNS(SLD_NS, "ColorMapEntry");
            String color = entry.get("color");
            String quantity = entry.get("quantity");
            String label = entry.get("label");
            if (color != null && !color.isEmpty())
                cmEntry.setAttribute("color", color);
            if (quantity != null && !quantity.isEmpty())
                cmEntry.setAttribute("quantity", quantity);
            if (label != null && !label.isEmpty())
                cmEntry.setAttribute("label", label);
            colorMap.appendChild(cmEntry);
        }
    }

    /**
     * 按 Rule 名称（或标题）查找 SLD 中的指定 Rule 节点。
     *
     * <p>
     * 优先按 {@code <sld:Name>} 精确匹配，因为 Name 是 Rule 的唯一标识
     * （我们的模板中 Name 分别为 point/Line/Polygon/raster）。
     * 如果 Name 不存在（有些第三方 SLD 只写了 Title），降级按 Title 匹配。
     *
     * <p>
     * XPath 使用 {@code //sld:Rule[...]} （双斜杠开头=全局搜索），
     * 不限于直接子元素，因为 SLD 结构中 Rule 在 FeatureTypeStyle 下。
     *
     * @param xp          配置好的 XPath 对象
     * @param doc         DOM Document
     * @param nameOrTitle Rule 的 Name 或 Title 文本
     * @return 匹配到的 Rule Element，没找到返回 null
     */
    private static Element findRuleNode(XPath xp, Document doc, String nameOrTitle) throws Exception {
        // 优先按 Name 匹配（我们模板中 Name 是唯一标识）
        NodeList nl = (NodeList) xp.evaluate(
                "//sld:Rule[sld:Name='" + nameOrTitle + "']", doc, XPathConstants.NODESET);
        if (nl.getLength() > 0)
            return (Element) nl.item(0);
        // 没找到 Name？按 Title 试试（兼容第三方 SLD）
        nl = (NodeList) xp.evaluate(
                "//sld:Rule[sld:Title='" + nameOrTitle + "']", doc, XPathConstants.NODESET);
        return nl.getLength() > 0 ? (Element) nl.item(0) : null;
    }

    /**
     * 在指定节点下通过相对 XPath 查找目标元素，设置其文本内容。
     *
     * <p>
     * 如果目标节点不存在（例如 SLD 中没有定义 Fill 颜色），
     * 自动调用 {@link #ensureNodePath} 沿路径逐级创建缺失节点。
     * 这样即使初始 SLD 是骨架结构，也能安全写入。
     * </p>
     *
     * @param xp            已配置命名空间的 XPath 对象
     * @param rule          相对 XPath 的基准节点（通常是 Rule 元素）
     * @param relativeXpath 相对于 rule 的 XPath（如
     *                      {@code sld:PolygonSymbolizer/sld:Fill/sld:CssParameter[@name='fill']}）
     * @param value         要写入的文本内容
     */
    private static void setNodeText(XPath xp, Element rule, String relativeXpath, String value) throws Exception {
        NodeList nl = (NodeList) xp.evaluate(relativeXpath, rule, XPathConstants.NODESET);
        if (nl.getLength() > 0) {
            // 节点已存在 → 直接改文本
            nl.item(0).setTextContent(value);
        } else {
            // 节点不存在 → 沿 XPath 逐级创建
            Element node = ensureNodePath(rule, relativeXpath);
            if (node != null)
                node.setTextContent(value);
        }
    }

    /**
     * 沿 XPath 路径在 DOM 中逐级创建缺失的节点。
     *
     * <p>
     * 例如 XPath
     * {@code sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:Fill/sld:CssParameter[@name='fill']}
     * 传入时，如果 Mark 或 Fill 不存在，它会自动创建这些中间节点。
     *
     * <p>
     * 处理逻辑：
     * <ol>
     * <li>按 {@code /} 拆分路径为若干段</li>
     * <li>对每段提取标签名（去掉 {@code sld:} 前缀）</li>
     * <li>如果有 {@code [@name='fill']} 这样的谓词，提取属性名和属性值</li>
     * <li>在当前节点的子元素中查找匹配的节点（命名空间+标签名+属性值）</li>
     * <li>找不到则创建新元素并追加为子节点</li>
     * </ol>
     *
     * @param parent        起始父节点
     * @param relativeXpath 相对于 parent 的 XPath
     * @return XPath 路径最末端的元素
     */
    private static Element ensureNodePath(Element parent, String relativeXpath) throws Exception {
        // ── Step 1: 拆路径 ────────────────────────────────────
        // "sld:PolygonSymbolizer/sld:Fill/sld:CssParameter[@name='fill']"
        //     → ["sld:PolygonSymbolizer", "sld:Fill", "sld:CssParameter[@name='fill']"]
        String[] segments = relativeXpath.split("/");
        Element current = parent;

        for (String seg : segments) {
            // ── Step 2: 解析路径段 ──────────────────────────────
            // 去掉 "sld:" 前缀，剩下 "PolygonSymbolizer" 或 "CssParameter[@name='fill']"
            String raw = seg.startsWith("sld:") ? seg.substring(4) : seg;
            String attrName = null, attrValue = null;

            // ── Step 3: 提取属性谓词 ────────────────────────────
            // 如果有 [@name='fill']，从中提取：
            //     attrName = "name", attrValue = "fill"
            // localName = "CssParameter"（去掉谓词部分）
            //
            // 为什么需要这个？
            // 一个 <Stroke> 下可能有多个 CssParameter：
            //   <CssParameter name="stroke">#000</CssParameter>
            //   <CssParameter name="stroke-width">2</CssParameter>
            // 必须带上 name 属性才能区分要创建哪一个。
            if (raw.contains("[@")) {
                // raw = "CssParameter[@name='fill']"
                int start = raw.indexOf("[@") + 2;           // "name='fill']" 的起始
                int eq = raw.indexOf("='", start);            // name 和 value 之间的 =
                int end = raw.indexOf("']", start);           // 结尾的 ']
                if (eq > 0 && end > 0) {
                    attrName = raw.substring(start, eq);      // "name"
                    attrValue = raw.substring(eq + 2, end);   // "fill"
                }
                raw = raw.substring(0, raw.indexOf('['));     // "CssParameter"
            }
            final String localName = raw; // "CssParameter" 或 "PolygonSymbolizer" 等

            // ── Step 4: 在当前子元素中查找是否已存在 ──────────
            // 不能直接用 getElementsByTagName——它会递归搜索所有后代，
            // 而我们只检查直接子元素（避免跳过中间层级）。
            NodeList children = current.getChildNodes();
            Element found = null;
            for (int i = 0; i < children.getLength(); i++) {
                if (children.item(i).getNodeType() != org.w3c.dom.Node.ELEMENT_NODE)
                    continue; // 跳过文本节点、注释等非元素节点
                Element child = (Element) children.item(i);
                // 必须同时匹配命名空间（SLD_NS）+ 标签名（CssParameter）
                // 检查子元素的命名空间URI和本地名称是否与预期值匹配
                // 如果命名空间URI不等于SLD_NS常量，或者本地名称不等于localName变量，
                // 则跳过当前循环迭代继续考察下一个child是否等于目标标签。
                if (!SLD_NS.equals(child.getNamespaceURI()) || !localName.equals(child.getLocalName()))
                    continue;
                // 如果有 [@name='fill']，还要匹配 name 属性值
                if (attrName != null && attrValue != null && !attrValue.equals(child.getAttribute(attrName)))
                    continue;
                found = child;
                break;
            }

            if (found != null) {
                // 节点已存在 → 进入下一层
                current = found;
            } else {
                // 找完了所有children都没找到 → 节点不存在 → 创建并追加为当前节点的子元素
                // 注意：所有 SLD 元素都必须用 SLD_NS 命名空间创建
                Element newEl = current.getOwnerDocument().createElementNS(SLD_NS, localName);
                if (attrName != null)
                    newEl.setAttribute(attrName, attrValue); // 设置 name="fill" 等属性
                current.appendChild(newEl);
                current = newEl;
            }
        }
        // Step 5: 返回最末端节点，调用方在这个元素上 setTextContent(colorValue)
        return current;
    }

    /** 检查 Element 下是否还有 Element 类型的子节点 */
    private static boolean hasElementChild(Element el) {
        NodeList children = el.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            if (children.item(i).getNodeType() == org.w3c.dom.Node.ELEMENT_NODE)
                return true;
        }
        return false;
    }

    // ── 删除节点 ────────────────────────────────────────────────
    // 与 ensureNodePath 对称：它逐级创建节点，这个逐级走到最后一步删除。
    // XPath 查整个文档（//sld:Rule[...]）是可以工作的（findRuleNode 在用），
    // 但相对于 Rule 节点的子查询全部 count=0，原因不明。
    // 所以 setNodeText 的 XPath 也走不通，一直 fallback 到 ensureNodePath。
    // 这里直接用手动遍历子节点 + 命名空间 + 属性匹配来定位并删除。
    // ─────────────────────────────────────────────────────────────

    private static void deleteNodePath(Element parent, String relativeXpath) {
        // 拆路径：sld:Stroke/sld:CssParameter[@name='stroke'] → [sld:Stroke, sld:CssParameter[@name='stroke']]
        String[] segments = relativeXpath.split("/");
        Element current = parent;

        for (int si = 0; si < segments.length; si++) {
            String seg = segments[si];
            // 去掉 sld: 前缀，取标签名
            String raw = seg.startsWith("sld:") ? seg.substring(4) : seg;
            String attrName = null, attrValue = null;

            // 如果有 [@name='stroke']，提取属性名和值
            // 因为一个 <Stroke> 下面可能有多个 <CssParameter>，需要靠属性区分。
            if (raw.contains("[@")) {
                int s = raw.indexOf("[@") + 2;
                int e1 = raw.indexOf("='", s);
                int e2 = raw.indexOf("']", s);
                if (e1 > 0 && e2 > 0) {
                    attrName = raw.substring(s, e1);
                    attrValue = raw.substring(e1 + 2, e2);
                }
                raw = raw.substring(0, raw.indexOf('['));
            }
            String localName = raw;
            boolean isLast = (si == segments.length - 1);

            // 在当前元素的直接子节点中，找匹配的
            NodeList children = current.getChildNodes();
            Element found = null;
            for (int i = 0; i < children.getLength(); i++) {
                if (children.item(i).getNodeType() != org.w3c.dom.Node.ELEMENT_NODE) continue;
                Element child = (Element) children.item(i);
                // 必须同时满足：同命名空间 + 同标签名 + 属性值匹配
                if (!SLD_NS.equals(child.getNamespaceURI()) || !localName.equals(child.getLocalName())) continue;
                // 如果有属性谓词，检查属性值是否匹配
                if (attrName != null && !attrValue.equals(child.getAttribute(attrName))) continue;
                // 找到匹配的子节点
                found = child;
                break;
            }

            if (found == null) return;       // 节点不存在 → 不用删，直接结束
            if (isLast) {
                current.removeChild(found);  // 路径最后一段 → 删除目标节点
                // 如果父节点没有其他 Element 子节点了（如 Stroke 下最后一个 CssParameter 被删），
                // 也删掉父节点，避免空标签（如 <sld:Stroke/>）导致 GeoServer 画默认黑框
                if (!hasElementChild(current)) {
                    current.getParentNode().removeChild(current);
                }
            } else {
                current = found;             // 中间段 → 继续往下走
            }
        }
    }

    /**
     * 读取 MapStyle 字段值（字符串形式）。
     * switch 覆盖所有 XPath 映射表中的字段名，编译器保证类型安全。
     */
    private static String getFieldValue(MapStyle ms, String fieldName) {
        return switch (fieldName) {
            case "fillcolor" -> ms.getFillcolor();
            case "fillopacity" -> ms.getFillopacity();
            case "bordercolor" -> ms.getBordercolor();
            case "borderwidth" -> ms.getBorderwidth();
            case "borderopacity" -> ms.getBorderopacity();
            case "size" -> ms.getSize();
            case "rotation" -> ms.getRotation();
            case "markname" -> ms.getMarkname();
            case "dash" -> ms.getDash();
            case "opacity" -> ms.getOpacity();
            default -> "";
        };
    }

    /**
     * 将 DOM Document 序列化为 XML 字符串。
     *
     * <p>
     * 相当于 XML 序列化的 "identity transform"——不做任何格式转换，
     * 原样输出 DOM 的结构。但会声明 UTF-8 编码（对中文支持是必要的）。
     *
     * @param doc 修改后的 DOM Document
     * @return 完整的 XML 字符串（包含 {@code <?xml version="1.0" encoding="UTF-8"?>}）
     */
    private static String serializeXml(Document doc) throws Exception {
        Transformer t = TransformerFactory.newInstance().newTransformer();
        // 保留 <?xml ...?> 声明
        t.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no"); 
        t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        StringWriter sw = new StringWriter();
        t.transform(new DOMSource(doc), new StreamResult(sw));
        return sw.toString();
    }
}
