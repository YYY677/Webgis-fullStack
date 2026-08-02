import type { LearningCatalogLesson } from "@/types/learning-catalog"

const thumbnailBase = "/learning-assets/openlayers-frontend-thumbnail"

export const olFrontendLessons: LearningCatalogLesson[] = [
  {
    routeName: "Basemap",
    title: "01-底图切换",
    path: "/ol-frontend-demo/basemap",
    summary: "在同一张二维地图中切换不同底图。",
    thumbnail: `${thumbnailBase}/01-basemap-switcher.png`,
    api: "TileLayer · Source",
    component: () => import("./01-basemap-switcher.vue"),
  },
  {
    routeName: "Tools",
    title: "02-基础工具",
    path: "/ol-frontend-demo/tools",
    summary: "体验常用的地图浏览与交互工具。",
    thumbnail: `${thumbnailBase}/02-basic-tools.png`,
    api: "Interaction · Control",
    component: () => import("./02-basic-tools.vue"),
  },
  {
    routeName: "LoadData",
    title: "03-加载数据",
    path: "/ol-frontend-demo/load-data",
    summary: "加载矢量、栅格等常见地图数据。",
    thumbnail: `${thumbnailBase}/03-load-data.png`,
    api: "VectorSource · GeoJSON",
    component: () => import("./03-load-data.vue"),
  },
  {
    routeName: "LayerControl",
    title: "04-图层控制",
    path: "/ol-frontend-demo/layer-control",
    summary: "管理图层显示、顺序与透明度。",
    thumbnail: `${thumbnailBase}/04-layer-control.png`,
    api: "Layer · Group",
    component: () => import("./04-layer-control.vue"),
  },
  {
    routeName: "MapSettingSearch",
    title: "05-地图设置与搜索",
    path: "/ol-frontend-demo/search-setting",
    summary: "组合地图设置与地点搜索能力。",
    thumbnail: `${thumbnailBase}/05-map-setting-search.png`,
    api: "View · Search",
    component: () => import("./05-map-setting-search.vue"),
  },
  {
    routeName: "ProvinceCharts",
    title: "06-省份数据可视化",
    path: "/ol-frontend-demo/province-charts",
    summary: "在地图中呈现省份业务数据与图表。",
    thumbnail: `${thumbnailBase}/06-province-charts.png`,
    api: "VectorLayer · ECharts",
    component: () => import("./06-province-charts.vue"),
  },
]
