export interface CesiumLesson {
  title: string
  path: string
  summary: string
}

export interface CesiumCatalogLesson extends CesiumLesson {
  api: string
  thumbnail: string
}

export const cesiumLessons: CesiumCatalogLesson[] = [
  {
    title: "01-Viewer 与场景初始化",
    path: "/cesium-demo/cesium-entry",
    summary: "创建 Viewer，配置场景与基础控件。",
    api: "Viewer · Scene",
    thumbnail: "/cesium-data/lesson-thumbnails/01-viewer-scene.png",
  },
  {
    title: "02-坐标转换与相机方位",
    path: "/cesium-demo/coordinates",
    summary: "在经纬度、笛卡尔坐标与相机方位之间转换。",
    api: "Cartesian3 · Camera",
    thumbnail: "/cesium-data/lesson-thumbnails/02-coordinates-camera.png",
  },
  {
    title: "03-屏幕空间事件",
    path: "/cesium-demo/events",
    summary: "响应鼠标输入并获取场景交互结果。",
    api: "ScreenSpaceEventHandler",
    thumbnail: "/cesium-data/lesson-thumbnails/03-screen-space-events.png",
  },
  {
    title: "04-Entity 图形与属性",
    path: "/cesium-demo/entity",
    summary: "用高层对象描述点、线、面与样式。",
    api: "Entity · Graphics",
    thumbnail: "/cesium-data/lesson-thumbnails/04-entity-graphics.png",
  },
  {
    title: "05-Primitive 与几何实例",
    path: "/cesium-demo/primitive",
    summary: "理解 GeometryInstance 与 Primitive 的渲染组织。",
    api: "Primitive · GeometryInstance",
    thumbnail: "/cesium-data/lesson-thumbnails/05-primitive-geometry.png",
  },
  {
    title: "06-数据源与三维数据加载",
    path: "/cesium-demo/data",
    summary: "加载 GeoJSON、CZML、glTF 模型和三维瓦片。",
    api: "DataSource · Model · Cesium3DTileset",
    thumbnail: "/cesium-data/lesson-thumbnails/06-data-3d.png",
  },
  {
    title: "07-3DTileset：加载、样式与拾取",
    path: "/cesium-demo/3dtiles",
    summary: "浏览大规模三维瓦片，控制样式、拾取和性能。",
    api: "Cesium3DTileset · Cesium3DTileStyle",
    thumbnail: "/cesium-data/lesson-thumbnails/07-3dtileset.png",
  },
  {
    title: "08-Clock 与动态轨迹",
    path: "/cesium-demo/timeline",
    summary: "让时钟驱动模型、轨迹和相机跟随。",
    api: "Clock · SampledPositionProperty",
    thumbnail: "/cesium-data/lesson-thumbnails/08-clock-trajectory.png",
  },
  {
    title: "09-交互绘制与量算",
    path: "/cesium-demo/draw-measure",
    summary: "交互生成 Entity，并完成距离与面积量算。",
    api: "Entity · ScreenSpaceEventHandler",
    thumbnail: "/cesium-data/lesson-thumbnails/09-entity-draw-measure.png",
  },
  {
    title: "10-地形采样与空间分析",
    path: "/cesium-demo/terrain-analysis",
    summary: "对地形进行高程、剖面、通视和坡度分析。",
    api: "sampleTerrainMostDetailed · Cartographic",
    thumbnail: "/cesium-data/lesson-thumbnails/10-terrain-analysis.png",
  },
  {
    title: "11-Entity 动态材质",
    path: "/cesium-demo/material-effects",
    summary: "通过 Entity 的 material 属性构建流光、动态墙与扩散效果。",
    api: "Entity · MaterialProperty",
    thumbnail: "/cesium-data/lesson-thumbnails/11-entity-material.png",
  },
  {
    title: "12-Model 与 3D Tiles 的 CustomShader",
    path: "/cesium-demo/custom-shader",
    summary: "为 glTF 模型和三维瓦片注入自定义着色逻辑。",
    api: "CustomShader · Model · Cesium3DTileset",
    thumbnail: "/cesium-data/lesson-thumbnails/12-custom-shader.png",
  },
  {
    title: "13-Primitive 与 Appearance",
    path: "/cesium-demo/custom-appearance",
    summary: "从几何属性到 GLSL，控制 Primitive 的渲染入口。",
    api: "Primitive · Appearance",
    thumbnail: "/cesium-data/lesson-thumbnails/13-primitive-appearance.png",
  },
  {
    title: "14-Scene 环境与出图",
    path: "/cesium-demo/scene-environment",
    summary: "控制天空、雾效、场景模式与画布导出。",
    api: "Scene · SkyBox · Canvas",
    thumbnail: "/cesium-data/lesson-thumbnails/14-scene-environment.png",
  },
  {
    title: "15-图层体系与图层树管理",
    path: "/cesium-demo/layer-management",
    summary: "用前端图层树组织影像、数据源、Entity 与 3D Tiles。",
    api: "ImageryLayerCollection · DataSourceCollection · PrimitiveCollection",
    thumbnail: "/cesium-data/lesson-thumbnails/15-layer-management.png",
  },
  {
    title: "16-前端标绘编辑与 GeoJSON 导出",
    path: "/cesium-demo/annotation-edit",
    summary: "创建并编辑点线面，在浏览器中导出标准 GeoJSON。",
    api: "Entity · ScreenSpaceEventHandler · GeoJSON",
    thumbnail: "/cesium-data/lesson-thumbnails/16-annotation-edit.png",
  },
  {
    title: "17-性能优化与资源生命周期",
    path: "/cesium-demo/performance-lifecycle",
    summary: "用按需渲染、事件清理和销毁顺序治理前端场景。",
    api: "Scene.requestRenderMode · Viewer.destroy",
    thumbnail: "/cesium-data/lesson-thumbnails/17-performance-lifecycle.png",
  },
]

export function getCesiumLessonTitle(path: string): string {
  const lesson = cesiumLessons.find((item) => item.path === path)
  if (!lesson) {
    throw new Error(`Cesium lesson catalog entry not found: ${path}`)
  }

  return lesson.title
}
