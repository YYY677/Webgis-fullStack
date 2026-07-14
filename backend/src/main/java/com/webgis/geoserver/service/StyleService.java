package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.MapStyle;
import com.webgis.geoserver.dto.StyleInfo;
import com.webgis.geoserver.style.SldModifier;
import com.webgis.geoserver.style.SldParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 样式管理 — 代理 GeoServer REST /rest/styles/* 接口
 */
@Service
public class StyleService {

    private static final Logger log = LoggerFactory.getLogger(StyleService.class);

    private final GeoServerClient client;

    public StyleService(GeoServerClient client) {
        this.client = client;
    }

    /** 列出所有样式 */
    @SuppressWarnings("unchecked")
    public List<StyleInfo> list() {
        Map<String, Object> root = client.get("/styles.json", Map.class);
        Object raw = root.get("styles");
        if (!(raw instanceof Map<?, ?> styles)) return List.of();
        if (styles.get("style") == null) return List.of();
        return WorkspaceService.normalizeList(styles.get("style")).stream()
                .map(m -> new StyleInfo(
                        m.get("name") != null ? m.get("name").toString() : null,
                        m.get("href") != null ? m.get("href").toString() : null))
                .toList();
    }

    /** 获取样式元数据详情 */
    public Map<String, Object> getDetail(String name) {
        return client.get("/styles/" + name + ".json", Map.class);
    }

    /** 获取 SLD 原始内容（纯文本 XML） */
    public String getSld(String name) {
        return client.getString("/styles/" + name + ".sld");
    }

    // ════════════════════════════════════════════════════════════════
    // SLD 模板说明：
    //
    // xmlns="http://www.opengis.net/sld"
    //     SLD 标准命名空间。所有 SLD 元素（Rule、PolygonSymbolizer 等）
    //     都归属这个 URI。更多解释见 SldParser 类注释。
    //
    // xmlns:ogc="http://www.opengis.net/ogc"
    //     OGC Filter 命名空间，用于 <ogc:Filter>、<ogc:PropertyIsEqualTo> 等。
    //
    // <Name>default</Name> (在 NamedLayer/UserStyle 中)
    //     样式内部标识。实际工作中 GeoServer 只认 catalog 注册名，
    //     SLD 内部写什么都无所谓。统一设为 "default"。
    //
    // <Title>default</Title> (在 UserStyle 中)
    //     样式展示名。同上，没人看这个值。
    //
    // <Abstract>STYLEDESC</Abstract>
    //     样式描述。创建时由用户输入，替换 STYLEDESC 占位符。
    //     唯一的 Rule 共享元数据。
    //
    // <Rule><Name>...</Name>
    //     Rule/Name 是 SldModifier 定位 Rule 的查找钥匙（XPath: //sld:Rule[sld:Name='...']），
    //     前端表单不可编辑。修改后 SldModifier 会找不到对应 Rule。
    //
    // <Rule><Title>...</Title>
    //     Rule/Title 是图例中显示的名称，前端表单可编辑。
    // ════════════════════════════════════════════════════════════════
    private static final String POINT_SLD = """
            <?xml version="1.0" encoding="UTF-8"?>
            <StyledLayerDescriptor version="1.0.0"
              xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
              xmlns="http://www.opengis.net/sld"
              xmlns:ogc="http://www.opengis.net/ogc"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <NamedLayer>
                <Name>default</Name>
                <UserStyle>
                  <Name>default</Name>
                  <Title>default</Title>
                  <Abstract>STYLEDESC</Abstract>
                  <FeatureTypeStyle>
                    <Rule>
                      <Name>point</Name>
                      <Title>Red Square Point</Title>
                      <PointSymbolizer>
                        <Graphic>
                          <Mark>
                            <WellKnownName>square</WellKnownName>
                            <Fill>
                              <CssParameter name="fill">#FF0000</CssParameter>
                            </Fill>
                          </Mark>
                          <Size>6</Size>
                        </Graphic>
                      </PointSymbolizer>
                    </Rule>
                  </FeatureTypeStyle>
                </UserStyle>
              </NamedLayer>
            </StyledLayerDescriptor>""";

    private static final String LINE_SLD = """
            <?xml version="1.0" encoding="UTF-8"?>
            <StyledLayerDescriptor version="1.0.0"
              xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
              xmlns="http://www.opengis.net/sld"
              xmlns:ogc="http://www.opengis.net/ogc"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <NamedLayer>
                <Name>default</Name>
                <UserStyle>
                  <Name>default</Name>
                  <Title>default</Title>
                  <Abstract>STYLEDESC</Abstract>
                  <FeatureTypeStyle>
                    <Rule>
                      <Name>Line</Name>
                      <Title>Blue Line</Title>
                      <LineSymbolizer>
                        <Stroke>
                          <CssParameter name="stroke">#0000FF</CssParameter>
                          <CssParameter name="stroke-opacity">1</CssParameter>
                        </Stroke>
                      </LineSymbolizer>
                    </Rule>
                  </FeatureTypeStyle>
                </UserStyle>
              </NamedLayer>
            </StyledLayerDescriptor>""";

    private static final String POLYGON_SLD = """
            <?xml version="1.0" encoding="UTF-8"?>
            <StyledLayerDescriptor version="1.0.0"
              xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
              xmlns="http://www.opengis.net/sld"
              xmlns:ogc="http://www.opengis.net/ogc"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <NamedLayer>
                <Name>default</Name>
                <UserStyle>
                  <Name>default</Name>
                  <Title>default</Title>
                  <Abstract>STYLEDESC</Abstract>
                  <FeatureTypeStyle>
                    <Rule>
                      <Name>Polygon</Name>
                      <Title>Grey Polygon</Title>
                      <PolygonSymbolizer>
                        <Fill>
                          <CssParameter name="fill">#AAAAAA</CssParameter>
                        </Fill>
                        <Stroke>
                          <CssParameter name="stroke">#000000</CssParameter>
                          <CssParameter name="stroke-width">1</CssParameter>
                        </Stroke>
                      </PolygonSymbolizer>
                    </Rule>
                  </FeatureTypeStyle>
                </UserStyle>
              </NamedLayer>
            </StyledLayerDescriptor>""";

    private static final String RASTER_SLD = """
            <?xml version="1.0" encoding="UTF-8"?>
            <StyledLayerDescriptor version="1.0.0"
              xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
              xmlns="http://www.opengis.net/sld"
              xmlns:ogc="http://www.opengis.net/ogc"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <NamedLayer>
                <Name>default</Name>
                <UserStyle>
                  <Name>default</Name>
                  <Title>default</Title>
                  <Abstract>STYLEDESC</Abstract>
                  <FeatureTypeStyle>
                    <Rule>
                      <Name>raster</Name>
                      <Title>ColorMap Raster</Title>
                      <RasterSymbolizer>
                        <Opacity>1.0</Opacity>
                        <ColorMap>
                          <ColorMapEntry color="#AAFFAA" quantity="0" label="values"/>
                          <ColorMapEntry color="#00FF00" quantity="1000" label="values"/>
                          <ColorMapEntry color="#FFFF00" quantity="1200" label="values"/>
                          <ColorMapEntry color="#FF7F00" quantity="1400" label="values"/>
                          <ColorMapEntry color="#BF7F3F" quantity="1600" label="values"/>
                          <ColorMapEntry color="#000000" quantity="2000" label="values"/>
                        </ColorMap>
                      </RasterSymbolizer>
                    </Rule>
                  </FeatureTypeStyle>
                </UserStyle>
              </NamedLayer>
            </StyledLayerDescriptor>""";

    private static final String GENERIC_SLD = """
            <?xml version="1.0" encoding="UTF-8"?>
            <StyledLayerDescriptor version="1.0.0"
              xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
              xmlns="http://www.opengis.net/sld"
              xmlns:ogc="http://www.opengis.net/ogc"
              xmlns:gml="http://www.opengis.net/gml"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <NamedLayer>
                <Name>default</Name>
                <UserStyle>
                  <Name>default</Name>
                  <Title>default</Title>
                  <Abstract>STYLEDESC</Abstract>
                  <FeatureTypeStyle>
                    <Rule>
                      <Name>raster</Name>
                      <Title>ColorMap Raster</Title>
                      <ogc:Filter>
                        <ogc:PropertyIsEqualTo>
                          <ogc:Function name="isCoverage"/>
                          <ogc:Literal>true</ogc:Literal>
                        </ogc:PropertyIsEqualTo>
                      </ogc:Filter>
                      <RasterSymbolizer>
                        <Opacity>1.0</Opacity>
                        <ColorMap>
                          <ColorMapEntry color="#AAFFAA" quantity="0" label="values"/>
                          <ColorMapEntry color="#00FF00" quantity="1000" label="values"/>
                          <ColorMapEntry color="#FFFF00" quantity="1200" label="values"/>
                          <ColorMapEntry color="#FF7F00" quantity="1400" label="values"/>
                          <ColorMapEntry color="#BF7F3F" quantity="1600" label="values"/>
                          <ColorMapEntry color="#000000" quantity="2000" label="values"/>
                        </ColorMap>
                      </RasterSymbolizer>
                    </Rule>
                    <Rule>
                      <Name>Polygon</Name>
                      <Title>Grey Polygon</Title>
                      <ogc:Filter>
                        <ogc:PropertyIsEqualTo>
                          <ogc:Function name="dimension">
                            <ogc:Function name="geometry"/>
                          </ogc:Function>
                          <ogc:Literal>2</ogc:Literal>
                        </ogc:PropertyIsEqualTo>
                      </ogc:Filter>
                      <PolygonSymbolizer>
                        <Fill>
                          <CssParameter name="fill">#AAAAAA</CssParameter>
                        </Fill>
                        <Stroke>
                          <CssParameter name="stroke">#000000</CssParameter>
                          <CssParameter name="stroke-width">1</CssParameter>
                        </Stroke>
                      </PolygonSymbolizer>
                    </Rule>
                    <Rule>
                      <Name>Line</Name>
                      <Title>Blue Line</Title>
                      <ogc:Filter>
                        <ogc:PropertyIsEqualTo>
                          <ogc:Function name="dimension">
                            <ogc:Function name="geometry"/>
                          </ogc:Function>
                          <ogc:Literal>1</ogc:Literal>
                        </ogc:PropertyIsEqualTo>
                      </ogc:Filter>
                      <LineSymbolizer>
                        <Stroke>
                          <CssParameter name="stroke">#0000FF</CssParameter>
                          <CssParameter name="stroke-opacity">1</CssParameter>
                        </Stroke>
                      </LineSymbolizer>
                    </Rule>
                    <Rule>
                      <Name>point</Name>
                      <Title>Red Square Point</Title>
                      <ElseFilter/>
                      <PointSymbolizer>
                        <Graphic>
                          <Mark>
                            <WellKnownName>square</WellKnownName>
                            <Fill>
                              <CssParameter name="fill">#FF0000</CssParameter>
                            </Fill>
                          </Mark>
                          <Size>6</Size>
                        </Graphic>
                      </PointSymbolizer>
                    </Rule>
                    <VendorOption name="ruleEvaluation">first</VendorOption>
                  </FeatureTypeStyle>
                </UserStyle>
              </NamedLayer>
            </StyledLayerDescriptor>""";

    /** 创建样式 — 按 type 选择预设 SLD 模板 */
    public String createWithSld(String name, String description, String type) {
        String sld = switch (type) {
            case "point"   -> POINT_SLD;
            case "line"    -> LINE_SLD;
            case "polygon" -> POLYGON_SLD;
            case "raster"  -> RASTER_SLD;
            default        -> GENERIC_SLD;
        };
        sld = sld.replace("STYLEDESC",
                description != null && !description.isBlank() ? description : name);
        client.postSld("/styles?name=" + name, sld);
        return name;
    }

    /** 更新 SLD 内容 */
    public void updateSld(String name, String sldBody) {
        client.putXml("/styles/" + name + ".sld", sldBody);
    }

    /** 重命名样式 — 只改 GeoServer catalog 注册名，SLD 内部 Name/Title 不再同步（没必要） */
    public void rename(String oldName, String newName) {
        client.put("/styles/" + oldName + ".json",
                Map.of("style", Map.of("name", newName)), String.class);
    }

    /** 解析 SLD → List<MapStyle>（供前端表单编辑） */
    public List<MapStyle> getStyleValue(String name) throws Exception {
        String sld = client.getString("/styles/" + name + ".sld");
        return SldParser.parse(sld);
    }

    /** DOM+XPath 修改 SLD 并保存 */
    public void updateStyleValue(String name, List<MapStyle> mapStyles) throws Exception {
        String sld = client.getString("/styles/" + name + ".sld"); // 获取当前样式原始 SLD 内容
        String modified = SldModifier.modify(sld, mapStyles);
        client.putXml("/styles/" + name + ".sld", modified);
    }

    /** 删除样式 */
    public void delete(String name) {
        client.delete("/styles/" + name + "?purge=true");
    }
}
