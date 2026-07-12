package com.webgis.geoserver.style;

import com.webgis.geoserver.dto.MapStyle;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 从 SLD XML 解析 MapStyle 列表 — 使用 DOM + XPath 读取，与 SldModifier 对称。
 *
 * <h3>职责</h3>
 * 将 GeoServer 返回的 SLD XML 解析为前端表单可编辑的 {@code List<MapStyle>}。
 * 每个 {@link MapStyle} 对应 SLD 中的一个 {@code <Rule>} 节点，
 * 包含该 Rule 的所有可编辑参数（填充色、边框宽、图例名等）。
 *
 * <h3>与 SldModifier 的对称关系</h3>
 * <ul>
 * <li>{@code SldParser} 负责读：SLD XML → {@code List<MapStyle>}（给前端表单展示）</li>
 * <li>{@link SldModifier} 负责写：{@code List<MapStyle>} → 修补 SLD XML（保存编辑结果）</li>
 * </ul>
 * 两者共享相同的 XPath 映射逻辑。Parser 读到的每个字段，
 * Modifier 一定能在同样的 XPath 位置写回去。
 *
 * <h3>工作流程</h3>
 * <ol>
 * <li>DOM 解析 SLD XML（{@code setNamespaceAware(true)} 是关键）</li>
 * <li>提取 UserStyle/Title（样式名）和 UserStyle/Abstract（样式描述）</li>
 * <li>用 XPath 枚举所有 {@code //sld:Rule} 节点</li>
 * <li>对每个 Rule：确定几何类型（点/线/面/栅格），提取对应参数</li>
 * <li>返回扁平化的 MapStyle 列表</li>
 * </ol>
 *
 * <p>
 * 注意：Rule/Name 是 XPath 查找的关键标识，不允许前端修改（否则修改后找不到对应 Rule）。
 * Rule/Title 则可以编辑，它显示在图例中。
 */
public class SldParser {

    /**
     * SLD 标准命名空间 URI。
     * 同一个值也定义在 SldModifier 中——保持两者一致。
     */
    private static final String SLD_NS = "http://www.opengis.net/sld";

    /**
     * 解析 SLD XML，提取每个 Rule 的可编辑参数。
     *
     * @param sldXml GeoServer 返回的 SLD XML 字符串
     * @return 每个 Rule 一个 MapStyle 的列表
     * @throws Exception SLD 格式错误、XPath 异常等
     */
    public static List<MapStyle> parse(String sldXml) throws Exception {
        // ── Step 1: DOM 解析 ────────────────────────────────────
        // setNamespaceAware(true) — 必须！否则 XPath 的 sld: 前缀匹配失效，
        // 所有 //sld:Rule 表达式返回空结果。
        javax.xml.parsers.DocumentBuilderFactory factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        // XML 字符串 → DOM 树
        // 之后可以通过 getElementsByTagName()、getChildNodes() 等导航这颗树。
        Document doc = factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(sldXml.getBytes(StandardCharsets.UTF_8)));

        // ── Step 2: XPath 命名空间绑定 ──────────────────────────
        XPath xp = XPathFactory.newInstance().newXPath(); // 创建 XPath 对象
        // 给 XPath 设置命名空间上下文。为什么？因为 SLD XML 中所有元素都属于
        // http://www.opengis.net/sld 这个命名空间，XPath 表达式里的 sld:Rule 需要知道
        // sld 前缀对应哪个 URI 才能匹配到元素。
        // "为什么不直接写 //Rule？"——因为 XPath 1.0 规定：没前缀的名字 = 空命名空间。
        // Rule 的意思是"找空命名空间的 Rule"，但 DOM 里的 Rule 属于 http://www.opengis.net/sld，不匹配。
        xp.setNamespaceContext(new javax.xml.namespace.NamespaceContext() {
            // XPath 遇到 "sld:Rule" 时，调这个方法问："sld 对应哪个 URI？"
            public String getNamespaceURI(String prefix) {
                // 只回答 sld，其他一律说不知道
                return "sld".equals(prefix) ? SLD_NS : null;
            }

            // 反向查询：给 URI 返回前缀。用不到。
            public String getPrefix(String uri) {
                return null;
            }

            // 反向查询：给 URI 返回所有前缀列表。用不到。
            public java.util.Iterator<String> getPrefixes(String uri) {
                return null;
            }
        });

        // ── Step 3: 读取样式级元数据 ────────────────────────────
        // UserStyle/Abstract 是所有 Rule 共享的描述信息，
        // 随便放在第一个 MapStyle 中带回前端。
        String styleDescription = xpathValue(doc.getDocumentElement(),
                "//sld:UserStyle/sld:Abstract", xp);

        // ── Step 4: 枚举所有 Rule 节点 ──────────────────────────
        // "//sld:Rule" 是全局绝对路径，不管 SLD 结构嵌套多深都能找到。
        NodeList rules = (NodeList) xp.evaluate("//sld:Rule", doc, XPathConstants.NODESET);
        List<MapStyle> result = new ArrayList<>();

        for (int i = 0; i < rules.getLength(); i++) {
            Element rule = (Element) rules.item(i);

            // ── Step 4a: 确定 Rule 的标识和几何类型 ─────────────
            // Rule 必须有 Name（我们模板中有）或 Title 作为标识。
            // 优先用 Name，没有 Name 才用 Title 兜底。
            String ruleName = getChildText(rule, "Name", xp);
            if (ruleName == null || ruleName.isEmpty()) {
                ruleName = getChildText(rule, "Title", xp);
            }
            if (ruleName == null || ruleName.isEmpty()) {
                ruleName = "rule-" + i; // 什么都不存在就用序号（几乎不会发生）
            }

            // 确定几何类型——通过 Rule 下的 Symbolizer 类型推断，
            // 不依赖 Rule/Name，免得用户改了 Name 就识别不了。
            String geomType = inferGeomType(rule, xp);
            if (geomType == null)
                continue; // 没有任何 Symbolizer → 跳过

            // ── Step 4b: 构建 MapStyle 对象 ─────────────────────
            MapStyle ms = new MapStyle();
            ms.setName(ruleName);
            ms.setGeomType(geomType);
            ms.setDescription(styleDescription);
            ms.setLegendTitle(getChildText(rule, "Title", xp));

            // 读取通用属性（所有几何类型都有）
            ms.setMinscale(getChildText(rule, "MinScaleDenominator", xp));
            ms.setMaxscale(getChildText(rule, "MaxScaleDenominator", xp));

            // ── Step 4c: 按几何类型读取个性参数 ─────────────────
            switch (geomType) {
                case "POLYGON" -> readPolygon(ms, rule, xp);
                case "LINE" -> readLine(ms, rule, xp);
                case "POINT" -> readPoint(ms, rule, xp);
                case "RASTER" -> readRaster(ms, rule, xp);
            }

            result.add(ms);
        }

        return result;
    }

    /**
     * 从 Rule 中读取面符号参数。
     *
     * XPath
     * 路径示例：{@code sld:PolygonSymbolizer/sld:Fill/sld:CssParameter[@name='fill']}
     * 意为：当前 Rule 的子元素 PolygonSymbolizer → Fill → 名为 fill 的 CssParameter
     * {@code @name='fill'} 是谓词（predicate），在 XPath 中表示筛选条件。
     */
    private static void readPolygon(MapStyle ms, Element rule, XPath xp) throws Exception {
        ms.setFillcolor(xpathValue(rule, "sld:PolygonSymbolizer/sld:Fill/sld:CssParameter[@name='fill']", xp));
        ms.setFillopacity(
                xpathValue(rule, "sld:PolygonSymbolizer/sld:Fill/sld:CssParameter[@name='fill-opacity']", xp));
        ms.setBordercolor(xpathValue(rule, "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke']", xp));
        ms.setBorderwidth(
                xpathValue(rule, "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-width']", xp));
        ms.setBorderopacity(
                xpathValue(rule, "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-opacity']", xp));
        ms.setDash(xpathValue(rule, "sld:PolygonSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-dasharray']", xp));
    }

    /**
     * 从 Rule 中读取线符号参数。
     * 线没有 Fill，只有 Stroke（颜色、宽度、透明度、虚线样式、端点样式、连接样式）。
     */
    private static void readLine(MapStyle ms, Element rule, XPath xp) throws Exception {
        ms.setBordercolor(xpathValue(rule, "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke']", xp));
        ms.setBorderwidth(xpathValue(rule, "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-width']", xp));
        ms.setBorderopacity(
                xpathValue(rule, "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-opacity']", xp));
        ms.setDash(xpathValue(rule, "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-dasharray']", xp));
        ms.setDashoffset(
                xpathValue(rule, "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-dashoffset']", xp));
        ms.setLinecap(xpathValue(rule, "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-linecap']", xp));
        ms.setLinejoin(xpathValue(rule, "sld:LineSymbolizer/sld:Stroke/sld:CssParameter[@name='stroke-linejoin']", xp));
    }

    /**
     * 从 Rule 中读取栅格符号参数。
     *
     * <p>
     * Opacity 是文本节点（setTextContent/setTextContent），
     * ColorMapEntry 是属性节点（setAttribute），两种不同的读取方式。
     * </p>
     *
     * <p>
     * 用 {@code getElementsByTagNameNS()} 而非 XPath 来查找 ColorMapEntry，
     * 因为一些 GeoServer 版本的 XPath 实现在 namespace-aware 模式下
     * 对 ColorMapEntry 的匹配不可靠。
     * </p>
     */
    private static void readRaster(MapStyle ms, Element rule, XPath xp) throws Exception {
        ms.setOpacity(xpathValue(rule, "sld:RasterSymbolizer/sld:Opacity", xp));

        // 解析 ColorMap — 用 getElementsByTagNameNS 比 XPath 更可靠
        // 这里是递归搜索 rule 下所有层级，比 XPath 的相对路径更宽松。
        NodeList cmEntries = rule.getElementsByTagNameNS(SLD_NS, "ColorMapEntry");
        if (cmEntries.getLength() == 0) {
            cmEntries = rule.getElementsByTagName("ColorMapEntry");
        }
        if (cmEntries.getLength() > 0) {
            java.util.List<java.util.Map<String, String>> entries = new java.util.ArrayList<>();
            for (int i = 0; i < cmEntries.getLength(); i++) {
                org.w3c.dom.Element e = (org.w3c.dom.Element) cmEntries.item(i);
                java.util.Map<String, String> m = new java.util.LinkedHashMap<>();
                // ColorMapEntry 数据在属性中，不是文本子节点
                m.put("color", e.getAttribute("color"));
                m.put("quantity", e.getAttribute("quantity"));
                if (e.hasAttribute("label"))
                    m.put("label", e.getAttribute("label"));
                entries.add(m);
            }
            ms.setColorMapEntries(entries);
        }
    }

    /**
     * 从 Rule 中读取点符号参数。
     * 点符号在 Graphic → Mark → WellKnownName / Fill / Stroke 中配置。
     */
    private static void readPoint(MapStyle ms, Element rule, XPath xp) throws Exception {
        ms.setSize(xpathValue(rule, "sld:PointSymbolizer/sld:Graphic/sld:Size", xp));
        ms.setMarkname(xpathValue(rule, "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:WellKnownName", xp));
        ms.setFillcolor(xpathValue(rule,
                "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:Fill/sld:CssParameter[@name='fill']", xp));
        ms.setBordercolor(xpathValue(rule,
                "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:Stroke/sld:CssParameter[@name='stroke']", xp));
        ms.setBorderwidth(xpathValue(rule,
                "sld:PointSymbolizer/sld:Graphic/sld:Mark/sld:Stroke/sld:CssParameter[@name='stroke-width']", xp));
    }

    /**
     * 在指定节点下用相对 XPath 查询，取第一个匹配元素的文本内容。
     * 支持属性定位节点（如 CssParameter[@name='fill']）
     *
     * <p>
     * 这是最常用的取值方法。XPath 相对于传入的节点（如 Rule）计算，
     * 找到目标元素后取其 {@code textContent}（即标签之间的文本）。
     *
     * <p>
     * 如果 XPath 找不到任何节点，返回空字符串（而不是 null 或异常）。
     * 这样前端表单看到的就是空白字段，用户可自行填写。
     *
     * @param rule          相对 XPath 的基准节点（通常是 Rule 元素）
     * @param relativeXpath 相对于 rule 的 XPath 表达式
     * @param xp            配置好的 XPath 对象
     * @return 节点文本，不存在返回空字符串
     */
    private static String xpathValue(Element rule, String relativeXpath, XPath xp) throws Exception {
        // 第三个参数决定返回值类型，这里要求返回 NodeList（节点列表）。XPathConstants.STRING-> string
        NodeList nl = (NodeList) xp.evaluate(relativeXpath, rule, XPathConstants.NODESET);
        return nl.getLength() > 0 ? nl.item(0).getTextContent().trim() : "";
    }

    /**
     * 取父节点下指定标签名的直接子元素文本。
     *
     * <p>
     * 与 xpathValue 不同，这个直接用 DOM 的 getElementsByTagNameNS，
     * 不经过 XPath 引擎。适用于 Rule/Name、Rule/Title 等直接用标签名就能定位的字段。
     * 适合在 Rule 下查找直接子元素。
     *
     * <p>
     * 先按命名空间查（getElementsByTagNameNS），找不到再回落
     * 到非命名空间方式（getElementsByTagName），兼容没有 namespace 声明的 SLD。
     *
     * @param parent  父元素（如 Rule）
     * @param tagName 标签名（如 "Name"、"Title"）
     * @param xp      XPath 对象（此处未使用，仅保持参数签名一致）
     * @return 子元素的文本内容，不存在返回空字符串
     */
    private static String getChildText(Element parent, String tagName, XPath xp) throws Exception {
        NodeList nl = parent.getElementsByTagNameNS(SLD_NS, tagName);
        if (nl.getLength() == 0)
            nl = parent.getElementsByTagName(tagName);
        return nl.getLength() > 0 ? nl.item(0).getTextContent().trim() : "";
    }

    /**
     * 根据 Rule 下的 Symbolizer 类型推断几何类型。
     *
     * <p>
     * 当 Rule/Name 不在 RULE_TO_GEOM 映射表中时（如第三方 SLD 使用自定义名称），
     * 通过检查 Rule 下有什么 Symbolizer 来推断。
     *
     * <p>
     * 优先级：Polygon > Line > Point > Raster
     * 一个 Rule 一般只有一个 Symbolizer，所以取第一个匹配的即可。
     *
     * @param rule Rule 元素
     * @param xp   XPath 对象
     * @return "POLYGON" / "LINE" / "POINT" / "RASTER"，都不匹配返回 null
     */
    private static String inferGeomType(Element rule, XPath xp) throws Exception {
        // 按优先级检查各 Symbolizer 是否存在
        for (String tag : new String[] { "PolygonSymbolizer", "LineSymbolizer", "PointSymbolizer",
                "RasterSymbolizer" }) {
            if (rule.getElementsByTagNameNS(SLD_NS, tag).getLength() > 0
                    || rule.getElementsByTagName(tag).getLength() > 0) {
                return switch (tag) {
                    case "PolygonSymbolizer" -> "POLYGON";
                    case "LineSymbolizer" -> "LINE";
                    case "PointSymbolizer" -> "POINT";
                    case "RasterSymbolizer" -> "RASTER";
                    default -> null;
                };
            }
        }
        return null;
    }
}
