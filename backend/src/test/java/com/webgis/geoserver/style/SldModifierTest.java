package com.webgis.geoserver.style;

import com.webgis.geoserver.dto.MapStyle;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SldModifierTest {

    @Test
    void removesPointStrokeWhenBorderColorIsCleared() throws Exception {
        String sld = """
                <sld:StyledLayerDescriptor xmlns:sld="http://www.opengis.net/sld">
                  <sld:NamedLayer><sld:UserStyle><sld:FeatureTypeStyle><sld:Rule>
                    <sld:Name>point</sld:Name>
                    <sld:PointSymbolizer><sld:Graphic><sld:Mark>
                      <sld:Fill><sld:CssParameter name="fill">#FF0000</sld:CssParameter></sld:Fill>
                      <sld:Stroke>
                        <sld:CssParameter name="stroke">#ffffff</sld:CssParameter>
                        <sld:CssParameter name="stroke-width">1</sld:CssParameter>
                      </sld:Stroke>
                    </sld:Mark><sld:Size>6</sld:Size></sld:Graphic></sld:PointSymbolizer>
                  </sld:Rule></sld:FeatureTypeStyle></sld:UserStyle></sld:NamedLayer>
                </sld:StyledLayerDescriptor>
                """;
        MapStyle style = new MapStyle();
        style.setGeomType("POINT");
        style.setName("point");
        style.setBordercolor("");
        style.setBorderwidth("1");

        String updated = SldModifier.modify(sld, List.of(style));

        assertThat(updated).doesNotContain("<sld:Stroke");
    }
}
