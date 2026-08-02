import { describe, expect, it } from "vitest"
import {
  coordinatesToWkt,
  normalizeGeometryKind,
  projectLonLatToWebMercator,
  wktToGeoJsonFeature,
} from "./cesium-fullstack-geometry"

describe("Cesium 全栈几何转换", () => {
  it("将数据库几何类型归一化为 Cesium 绘制类型", () => {
    expect(normalizeGeometryKind("POINT")).toBe("point")
    expect(normalizeGeometryKind("MULTILINESTRING")).toBe("line")
    expect(normalizeGeometryKind("MULTIPOLYGON")).toBe("polygon")
  })

  it("将经纬度投影为 Web Mercator 米制坐标", () => {
    const [x, y] = projectLonLatToWebMercator([180, 0])

    expect(x).toBeCloseTo(20_037_508.34, 2)
    expect(y).toBeCloseTo(0, 6)
  })

  it("根据点线面顶点生成 WKT，并自动闭合多边形", () => {
    expect(coordinatesToWkt("point", [[114, 22]], "EPSG:4326")).toBe(
      "POINT(114 22)",
    )
    expect(
      coordinatesToWkt(
        "line",
        [
          [114, 22],
          [115, 23],
        ],
        "EPSG:4326",
      ),
    ).toBe("LINESTRING(114 22, 115 23)")
    expect(
      coordinatesToWkt(
        "polygon",
        [
          [114, 22],
          [115, 22],
          [115, 23],
        ],
        "EPSG:4326",
      ),
    ).toBe("POLYGON((114 22, 115 22, 115 23, 114 22))")
  })

  it("把指定投影的 WKT 转为 Cesium 可加载的 4326 GeoJSON", () => {
    const feature = wktToGeoJsonFeature(
      "POINT(1113194.9079327357 0)",
      "EPSG:3857",
    )

    expect(feature.geometry.type).toBe("Point")
    expect(feature.geometry.coordinates[0]).toBeCloseTo(10, 6)
    expect(feature.geometry.coordinates[1]).toBeCloseTo(0, 6)
  })
})
