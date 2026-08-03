import type { LearningCatalogLesson } from "@/types/learning-catalog"
import { publicUrl } from "@/utils/public-url"

const thumbnailBase = publicUrl("learning-assets/openlayers-fullstack-thumbnail")

export const olFullstackLessons: LearningCatalogLesson[] = [
  {
    routeName: "GeoserverLoad",
    title: "01-GeoServer 加载数据",
    path: "/ol-fullstack-demo/geoserver-load",
    summary: "通过 WMS、WMTS、WFS 将 GeoServer 服务加载到地图。",
    thumbnail: `${thumbnailBase}/01-geoserver-load.png`,
    api: "WMS · WMTS · WFS",
    component: () => import("./01-geoserver-load.vue"),
  },
  {
    routeName: "GeoserverWfs",
    title: "02-WFS 实现增删改查",
    path: "/ol-fullstack-demo/geoserver-wfs",
    summary: "使用 WFS-T 完成服务端要素编辑。",
    thumbnail: `${thumbnailBase}/02-geoserver-wfs.png`,
    api: "WFS-T",
    component: () => import("./02-geoserver-wfs.vue"),
  },
  {
    routeName: "SpatialEditor",
    title: "03-后端空间数据 CRUD",
    path: "/ol-fullstack-demo/spatial-editor",
    summary: "通过 Spring Boot API 读写 PostGIS 空间表。",
    thumbnail: `${thumbnailBase}/03-spatial-editor.png`,
    api: "PostGIS · WKT",
    component: () => import("./03-spatial-editor.vue"),
  },
  {
    routeName: "DataManagement",
    title: "04-后端 API 数据管理",
    path: "/ol-fullstack-demo/data-management",
    summary: "管理 GeoServer 工作区、数据存储和图层。",
    thumbnail: `${thumbnailBase}/04-data-management.png`,
    api: "GeoServer REST",
    component: () => import("./04-data-management.vue"),
  },
  {
    routeName: "StyleManagement",
    title: "05-后端 API 样式管理",
    path: "/ol-fullstack-demo/style-management",
    summary: "通过后端接口维护 SLD 图层样式。",
    thumbnail: `${thumbnailBase}/05-style-management.png`,
    api: "SLD · GeoServer REST",
    component: () => import("./05-style-management.vue"),
  },
  {
    routeName: "SpatialAnalysis",
    title: "06-后端空间分析",
    path: "/ol-fullstack-demo/spatial-analysis",
    summary: "调用 JTS 与 pgRouting 完成分析和路径计算。",
    thumbnail: `${thumbnailBase}/06-spatial-analysis.png`,
    api: "JTS · pgRouting",
    component: () => import("./06-spatial-analysis.vue"),
  },
]
