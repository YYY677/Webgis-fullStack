import { createRouter, createWebHashHistory } from "vue-router"
import type { RouteRecordRaw } from "vue-router"
import { getToken } from "@/utils/localStorage"

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    component: () => import("@/pages/login/index.vue"),
    meta: { hidden: true }
  },
  {
    path: "/404",
    component: () => import("@/pages/error/404.vue"),
    meta: { hidden: true }
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
        meta: { title: "首页", icon: "HomeFilled", affix: true }
      },
      {
        path: "demo/element-plus",
        name: "ElementPlus",
        component: () => import("@/pages/demo/element-plus/index.vue"),
        meta: { title: "组件示例", icon: "Grid" }
      },
      {
        path: "map-demo",
        name: "MapDemo",
        redirect: "/map-demo/tianditu",
        meta: { title: "Map Demo", icon: "MapLocation" },
        children: [
          {
            path: "tianditu",
            name: "Tianditu",
            component: () => import("@/pages/map-demo/openlayers-tianditu.vue"),
            meta: { title: "天地图" }
          },
          {
            path: "wfs",
            name: "Wfs",
            component: () => import("@/pages/map-demo/openlayers-wfs.vue"),
            meta: { title: "WFS 查询" }
          },
          {
            path: "cesium",
            name: "Cesium",
            component: () => import("@/pages/map-demo/cesium.vue"),
            meta: { title: "Cesium 3D" }
          }
        ]
      }
    ]
  },
  { path: "/:pathMatch(.*)*", redirect: "/404" }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const token = getToken()
  if (to.path === "/login") {
    token ? next("/") : next()
  } else {
    token ? next() : next("/login")
  }
})

export default router
