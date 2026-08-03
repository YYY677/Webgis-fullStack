import type { LearningCatalogLesson } from "@/types/learning-catalog"
import { publicUrl } from "@/utils/public-url"

const thumbnailBase = publicUrl("learning-assets/cesium-fullstack-thumbnail")

export const cesiumFullstackLessons: LearningCatalogLesson[] = [
  {
    routeName: "CesiumGeoServerServices",
    title: "01-GeoServer 服务接入",
    path: "/cesium-fullstack-demo/geoserver-services",
    summary: "用 WMS 与 WFS 将 GeoServer 的二维服务接入三维场景。",
    thumbnail: `${thumbnailBase}/01-geoserver-services.png`,
    api: "WebMapServiceImageryProvider · GeoJsonDataSource",
    component: () => import("./01-geoserver-services.vue"),
  },
  {
    routeName: "CesiumSpatialCrud",
    title: "02-空间要素 CRUD",
    path: "/cesium-fullstack-demo/spatial-crud",
    summary: "将 Entity 与现有 PostGIS 空间表 CRUD 接口连接起来。",
    thumbnail: `${thumbnailBase}/02-spatial-crud.png`,
    api: "/api/spatial/** · Entity · WKT",
    component: () => import("./02-spatial-crud.vue"),
  },
  {
    routeName: "CesiumServerAnalysis",
    title: "03-服务端空间分析与路径",
    path: "/cesium-fullstack-demo/server-analysis",
    summary: "把 Cesium 交互几何提交给 JTS 与 pgRouting，并显示服务端结果。",
    thumbnail: `${thumbnailBase}/03-server-analysis.png`,
    api: "/api/spatial/analysis/** · WebMercatorProjection",
    component: () => import("./03-server-analysis.vue"),
  },
]
