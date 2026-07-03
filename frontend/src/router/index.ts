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
          {
            path: "tianditu",
            name: "Tianditu",
            component: () => import("@/pages/ol-frontend-demo/openlayers-tianditu.vue"),
            meta: { title: "天地图" },
          },
          {
            path: "wfs",
            name: "Wfs",
            component: () => import("@/pages/ol-frontend-demo/openlayers-wfs.vue"),
            meta: { title: "WFS 查询" },
          },
          {
            path: "cesium",
            name: "Cesium",
            component: () => import("@/pages/ol-frontend-demo/cesium.vue"),
            meta: { title: "Cesium 3D" },
          },
        ],
      },
      {
        path: "ol-backend-demo",
        name: "OlBackendDemo",
        redirect: "/ol-backend-demo/basemap",
        meta: { title: "后端 OL Demo", icon: "Platform" },
        children: [
          {
            path: "geoserver",
            name: "Geoserver",
            component: () => import("@/pages/ol-backend-demo/01-geoserver-load.vue"),
            meta: { title: "01-Geoserver加载数据" },
          },
        ],
      },
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
