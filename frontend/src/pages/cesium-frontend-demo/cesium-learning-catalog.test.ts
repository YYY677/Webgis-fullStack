import { describe, expect, it } from "vitest"
import {
  cesiumLessons,
} from "./cesium-learning-catalog"

describe("Cesium learning catalog", () => {
  it("keeps all seventeen lessons in existing file order", () => {
    expect(cesiumLessons).toHaveLength(17)
    expect(cesiumLessons.map((lesson) => lesson.path)).toEqual([
      "/cesium-demo/cesium-entry",
      "/cesium-demo/coordinates",
      "/cesium-demo/events",
      "/cesium-demo/entity",
      "/cesium-demo/primitive",
      "/cesium-demo/data",
      "/cesium-demo/3dtiles",
      "/cesium-demo/timeline",
      "/cesium-demo/draw-measure",
      "/cesium-demo/terrain-analysis",
      "/cesium-demo/material-effects",
      "/cesium-demo/custom-shader",
      "/cesium-demo/custom-appearance",
      "/cesium-demo/scene-environment",
      "/cesium-demo/layer-management",
      "/cesium-demo/annotation-edit",
      "/cesium-demo/performance-lifecycle",
    ])
  })

  it("describes material, shader, and appearance with their actual rendering APIs", () => {
    expect(cesiumLessons.slice(10, 13)).toMatchObject([
      {
        title: "11-Entity 动态材质",
        api: "Entity · MaterialProperty",
        thumbnail: "/cesium-data/lesson-thumbnails/11-entity-material.png",
      },
      {
        title: "12-Model 与 3D Tiles 的 CustomShader",
        api: "CustomShader · Model · Cesium3DTileset",
      },
      {
        title: "13-Primitive 与 Appearance",
        api: "Primitive · Appearance",
      },
    ])
  })

  it("maps every lesson to its generated local thumbnail", () => {
    expect(cesiumLessons.map((lesson) => lesson.thumbnail)).toEqual([
      "/cesium-data/lesson-thumbnails/01-viewer-scene.png",
      "/cesium-data/lesson-thumbnails/02-coordinates-camera.png",
      "/cesium-data/lesson-thumbnails/03-screen-space-events.png",
      "/cesium-data/lesson-thumbnails/04-entity-graphics.png",
      "/cesium-data/lesson-thumbnails/05-primitive-geometry.png",
      "/cesium-data/lesson-thumbnails/06-data-3d.png",
      "/cesium-data/lesson-thumbnails/07-3dtileset.png",
      "/cesium-data/lesson-thumbnails/08-clock-trajectory.png",
      "/cesium-data/lesson-thumbnails/09-entity-draw-measure.png",
      "/cesium-data/lesson-thumbnails/10-terrain-analysis.png",
      "/cesium-data/lesson-thumbnails/11-entity-material.png",
      "/cesium-data/lesson-thumbnails/12-custom-shader.png",
      "/cesium-data/lesson-thumbnails/13-primitive-appearance.png",
      "/cesium-data/lesson-thumbnails/14-scene-environment.png",
      "/cesium-data/lesson-thumbnails/placeholder.svg",
      "/cesium-data/lesson-thumbnails/placeholder.svg",
      "/cesium-data/lesson-thumbnails/placeholder.svg",
    ])
  })

  it("adds layer management, annotation editing, and lifecycle as consecutive front-end lessons", () => {
    expect(cesiumLessons.slice(-3)).toMatchObject([
      { title: "15-图层体系与图层树管理", api: "ImageryLayerCollection · DataSourceCollection · PrimitiveCollection" },
      { title: "16-前端标绘编辑与 GeoJSON 导出", api: "Entity · ScreenSpaceEventHandler · GeoJSON" },
      { title: "17-性能优化与资源生命周期", api: "Scene.requestRenderMode · Viewer.destroy" },
    ])
  })
})
