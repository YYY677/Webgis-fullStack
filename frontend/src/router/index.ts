import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { getToken } from "@/utils/localStorage";

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
        redirect: "/ol-backend-demo/basemap", 
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
        redirect: "/cesium-demo/cesium-entry",
        meta: { title: "Cesium Demo", icon: "Camera" },
        children:[
          {
            path: "cesium-entry",
            name: "CesiumEntry",
            component: () => import("@/pages/cesium-frontend-demo/01-cesium-entry.vue"),
            meta: { title: "01-初识Cesium" },
          },
          {
            path: "coordinates",
            name: "CesiumCoordinates",
            component: () => import("@/pages/cesium-frontend-demo/02-cesium-coordinates.vue"),
            meta: { title: "02-坐标与方位角" },
          },
          {
            path: "events",
            name: "CesiumEvents",
            component: () => import("@/pages/cesium-frontend-demo/03-cesium-events.vue"),
            meta: { title: "03-事件监听" },
          },
          {
            path: "entity",
            name: "CesiumEntity",
            component: () => import("@/pages/cesium-frontend-demo/04-cesium-entity.vue"),
            meta: { title: "04-Entity" },
          },
          {
            path: "primitive",
            name: "CesiumPrimitive",
            component: () => import("@/pages/cesium-frontend-demo/05-cesium-primitive.vue"),
            meta: { title: "05-Primitive" },
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
