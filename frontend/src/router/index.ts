import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { getCesiumLessonTitle } from "@/pages/cesium-frontend-demo/cesium-learning-catalog";
import { getToken } from "@/utils/localStorage";

const cesiumLessonMeta = (path: string) => ({ title: getCesiumLessonTitle(path) });

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    component: () => import("@/pages/login/index.vue"),
    meta: { hidden: true },
  },
  {
    path: "/404",
    component: () => import("@/pages/error/404.vue"),
    meta: { hidden: true },
  },
  {
    path: "/",
    component: () => import("@/layout/MainLayout.vue"),
    redirect: "/dashboard",
    children: [
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("@/pages/dashboard/index.vue"),
        meta: { title: "首页", icon: "HomeFilled", affix: true },
      },
      {
        path: "demo/element-plus",
        name: "ElementPlus",
        component: () => import("@/pages/demo/element-plus/index.vue"),
        meta: { title: "组件示例", icon: "Grid" },
      },
      {
        path: "ol-frontend-demo",
        name: "OlFrontendDemo",
        redirect: "/ol-frontend-demo/basemap",
        meta: { title: "静态 OL Demo", icon: "MapLocation" },
        children: [
          {
            path: "basemap",
            name: "Basemap",
            component: () => import("@/pages/ol-frontend-demo/01-basemap-switcher.vue"),
            meta: { title: "01-底图切换" },
          },
          {
            path: "tools",
            name: "Tools",
            component: () => import("@/pages/ol-frontend-demo/02-basic-tools.vue"),
            meta: { title: "02-基础工具" },
          },
          {
            path: "load-data",
            name: "LoadData",
            component: () => import("@/pages/ol-frontend-demo/03-load-data.vue"),
            meta: { title: "03-加载数据" },
          },
          {
            path: "layer-control",
            name: "LayerControl",
            component: () => import("@/pages/ol-frontend-demo/04-layer-control.vue"),
            meta: { title: "04-图层控制" },
          },
          {
            path: "search-setting",
            name: "MapSettingSearch",
            component: () =>
              import("@/pages/ol-frontend-demo/05-map-setting-search.vue"),
            meta: { title: "05-地图设置与搜索" },
          },
          {
            path: "province-charts",
            name: "ProvinceCharts",
            component: () => import("@/pages/ol-frontend-demo/06-province-charts.vue"),
            meta: { title: "06-省份数据可视化" },
          },
        ],
      },
      {
        path: "ol-backend-demo",
        name: "OlBackendDemo",
        redirect: "/ol-backend-demo/geoserver-load", 
        meta: { title: "全栈 OL Demo", icon: "Platform" },
        children: [
          {
            path: "geoserver-load",
            name: "GeoserverLoad",
            component: () => import("@/pages/ol-backend-demo/01-geoserver-load.vue"),
            meta: { title: "01-Geoserver加载数据" },
          },
          {
            path: "geoserver-wfs",
            name: "GeoserverWfs",
            component: () => import("@/pages/ol-backend-demo/02-geoserver-wfs.vue"),
            meta: { title: "02-WFS实现增删改查" },
          },
          {
            path: "spatial-editor",
            name: "SpatialEditor",
            component: () => import("@/pages/ol-backend-demo/03-spatial-editor.vue"),
            meta: { title: "03-后端空间数据CRUD" },
          },
          {
            path: "data-management",
            name: "DataManagement",
            component: () =>
              import("@/pages/ol-backend-demo/04-data-management.vue"),
            meta: { title: "04-后端API数据管理" },
          },
          {
            path: "style-management",
            name: "StyleManagement",
            component: () =>
              import("@/pages/ol-backend-demo/05-style-management.vue"),
            meta: { title: "05-后端API样式管理" },
          },
          {
            path: "spatial-analysis",
            name: "SpatialAnalysis",
            component: () =>
              import("@/pages/ol-backend-demo/06-spatial-analysis.vue"),
            meta: { title: "06-后端空间分析" },
          },
        ],
      },
      {
        path: "cesium-demo",
        name: "CesiumDemo",
        redirect: "/cesium-demo",
        meta: { title: "Cesium Demo", icon: "Camera" },
        children:[
          {
            path: "",
            name: "CesiumLearningHome",
            component: () => import("@/pages/cesium-frontend-demo/index.vue"),
            meta: { title: "Cesium 学习首页" },
          },
          {
            path: "cesium-entry",
            name: "CesiumEntry",
            component: () => import("@/pages/cesium-frontend-demo/01-cesium-entry.vue"),
            meta: cesiumLessonMeta("/cesium-demo/cesium-entry"),
          },
          {
            path: "coordinates",
            name: "CesiumCoordinates",
            component: () => import("@/pages/cesium-frontend-demo/02-cesium-coordinates.vue"),
            meta: cesiumLessonMeta("/cesium-demo/coordinates"),
          },
          {
            path: "events",
            name: "CesiumEvents",
            component: () => import("@/pages/cesium-frontend-demo/03-cesium-events.vue"),
            meta: cesiumLessonMeta("/cesium-demo/events"),
          },
          {
            path: "entity",
            name: "CesiumEntity",
            component: () => import("@/pages/cesium-frontend-demo/04-cesium-entity.vue"),
            meta: cesiumLessonMeta("/cesium-demo/entity"),
          },
          {
            path: "primitive",
            name: "CesiumPrimitive",
            component: () => import("@/pages/cesium-frontend-demo/05-cesium-primitive.vue"),
            meta: cesiumLessonMeta("/cesium-demo/primitive"),
          },
          {
            path: "data",
            name: "CesiumData",
            component: () => import("@/pages/cesium-frontend-demo/06-cesium-data.vue"),
            meta: cesiumLessonMeta("/cesium-demo/data"),
          },
          {
            path: "3dtiles",
            name: "Cesium3DTiles",
            component: () => import("@/pages/cesium-frontend-demo/07-cesium-3dtiles.vue"),
            meta: cesiumLessonMeta("/cesium-demo/3dtiles"),
          },
          {
            path: "timeline",
            name: "CesiumTimeline",
            component: () => import("@/pages/cesium-frontend-demo/08-cesium-timeline.vue"),
            meta: cesiumLessonMeta("/cesium-demo/timeline"),
          },
          {
            path: "draw-measure",
            name: "CesiumDrawMeasure",
            component: () => import("@/pages/cesium-frontend-demo/09-cesium-draw-measure.vue"),
            meta: cesiumLessonMeta("/cesium-demo/draw-measure"),
          },
          {
            path: "terrain-analysis",
            name: "CesiumTerrainAnalysis",
            component: () => import("@/pages/cesium-frontend-demo/10-cesium-terrain-analysis.vue"),
            meta: cesiumLessonMeta("/cesium-demo/terrain-analysis"),
          },
          {
            path: "material-effects",
            name: "CesiumMaterialEffects",
            component: () => import("@/pages/cesium-frontend-demo/11-cesium-material-effects.vue"),
            meta: cesiumLessonMeta("/cesium-demo/material-effects"),
          },
          {
            path: "custom-shader",
            name: "CesiumCustomShader",
            component: () => import("@/pages/cesium-frontend-demo/12-cesium-custom-shader.vue"),
            meta: cesiumLessonMeta("/cesium-demo/custom-shader"),
          },
          {
            path: "custom-appearance",
            name: "CesiumCustomAppearance",
            component: () => import("@/pages/cesium-frontend-demo/13-cesium-custom-appearance.vue"),
            meta: cesiumLessonMeta("/cesium-demo/custom-appearance"),
          },
          {
            path: "scene-environment",
            name: "CesiumSceneEnvironment",
            component: () => import("@/pages/cesium-frontend-demo/14-cesium-scene-environment.vue"),
            meta: cesiumLessonMeta("/cesium-demo/scene-environment"),
          },
          {
            path: "layer-management",
            name: "CesiumLayerManagement",
            component: () => import("@/pages/cesium-frontend-demo/15-cesium-layer-management.vue"),
            meta: cesiumLessonMeta("/cesium-demo/layer-management"),
          },
          {
            path: "annotation-edit",
            name: "CesiumAnnotationEdit",
            component: () => import("@/pages/cesium-frontend-demo/16-cesium-annotation-edit.vue"),
            meta: cesiumLessonMeta("/cesium-demo/annotation-edit"),
          },
          {
            path: "performance-lifecycle",
            name: "CesiumPerformanceLifecycle",
            component: () => import("@/pages/cesium-frontend-demo/17-cesium-performance-lifecycle.vue"),
            meta: cesiumLessonMeta("/cesium-demo/performance-lifecycle"),
          }
        ]
      }
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/404" },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = getToken();
  if (to.path === "/login") {
    token ? next("/") : next();
  } else {
    token ? next() : next("/login");
  }
});

export default router;
export { routes };
