import { describe, expect, it } from "vitest"
import {
  annotationToFeatureCollection,
  consumePostDragClick,
  translateAnnotationCoordinates,
  type Annotation,
} from "./16-cesium-annotation-edit.vue"

describe("16 标绘 GeoJSON 导出", () => {
  it("将贴地多边形导出为闭合的二维 WGS84 坐标环", () => {
    const annotation: Annotation = {
      id: "area-1",
      name: "警戒范围",
      type: "polygon",
      color: "#1677ff",
      coordinates: [[116.39, 39.9], [116.4, 39.9], [116.4, 39.91]],
    }

    const collection = annotationToFeatureCollection([annotation])

    expect(collection.features[0].geometry).toEqual({
      type: "Polygon",
      coordinates: [[[116.39, 39.9], [116.4, 39.9], [116.4, 39.91], [116.39, 39.9]]],
    })
  })

  it("保留点、线要素的 id、名称、类型和展示样式", () => {
    const annotations: Annotation[] = [
      { id: "point-1", name: "巡检点", type: "point", color: "#f5222d", coordinates: [[116.39, 39.9]] },
      { id: "line-1", name: "巡检线", type: "line", color: "#faad14", coordinates: [[116.39, 39.9], [116.4, 39.91]] },
    ]

    const collection = annotationToFeatureCollection(annotations)

    expect(collection.features).toMatchObject([
      { id: "point-1", properties: { name: "巡检点", type: "point", color: "#f5222d" }, geometry: { type: "Point", coordinates: [116.39, 39.9] } },
      { id: "line-1", properties: { name: "巡检线", type: "line", color: "#faad14" }, geometry: { type: "LineString", coordinates: [[116.39, 39.9], [116.4, 39.91]] } },
    ])
  })

  it("只忽略顶点拖拽结束后紧随的一次点击", () => {
    expect(consumePostDragClick(true)).toEqual({ shouldHandle: false, nextShouldIgnore: false })
    expect(consumePostDragClick(false)).toEqual({ shouldHandle: true, nextShouldIgnore: false })
  })

  it("translates line and polygon vertices by one WGS84 delta", () => {
    expect(translateAnnotationCoordinates(
      [[116.39, 39.9], [116.4, 39.91]],
      [0.02, -0.01],
    )).toEqual([[116.41, 39.89], [116.42, 39.9]])
  })
})
