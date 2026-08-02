import { createRouter, createWebHashHistory } from "vue-router"
import type { RouteRecordRaw } from "vue-router"
import { cesiumFullstackLessons } from "@/pages/cesium-fullstack-demo/cesium-fullstack-learning-catalog"
import { cesiumLessons } from "@/pages/cesium-frontend-demo/cesium-learning-catalog"
import { olFrontendLessons } from "@/pages/ol-frontend-demo/ol-learning-catalog"
import { olFullstackLessons } from "@/pages/ol-fullstack-demo/ol-learning-catalog"
import type { LearningCatalogLesson } from "@/types/learning-catalog"
import { getToken } from "@/utils/localStorage"

function createLessonRoutes(lessons: LearningCatalogLesson[]): RouteRecordRaw[] {
  return lessons.map((lesson) => ({
    path: lesson.path.slice(lesson.path.lastIndexOf("/") + 1), // 取 path 的最后一段作为子路由路径
    name: lesson.routeName,
    component: lesson.component,
    meta: { title: lesson.title },
  }))
}

const routes: RouteRecordRaw[] = [
  { path: "/login", component: () => import("@/pages/login/index.vue"), meta: { hidden: true } },
  { path: "/404", component: () => import("@/pages/error/404.vue"), meta: { hidden: true } },
  {
    path: "/",
    component: () => import("@/layout/MainLayout.vue"),
    redirect: "/dashboard",
    children: [
      { path: "dashboard", name: "Dashboard", component: () => import("@/pages/dashboard/index.vue"), meta: { title: "首页", icon: "HomeFilled", affix: true } },
      { path: "demo/element-plus", name: "ElementPlus", component: () => import("@/pages/demo/element-plus/index.vue"), meta: { title: "组件示例", icon: "Grid" } },
      {
        path: "ol-frontend-demo", name: "OlFrontendDemo", redirect: "/ol-frontend-demo", meta: { title: "静态 OL Demo", icon: "MapLocation" },
        children: [
          { path: "", name: "OlFrontendHome", component: () => import("@/pages/ol-frontend-demo/index.vue"), meta: { title: "OL 前端学习首页" } },
          ...createLessonRoutes(olFrontendLessons),
        ],
      },
      {
        path: "ol-fullstack-demo", name: "OlFullstackDemo", redirect: "/ol-fullstack-demo", meta: { title: "全栈 OL Demo", icon: "Platform" },
        children: [
          { path: "", name: "OlFullstackHome", component: () => import("@/pages/ol-fullstack-demo/index.vue"), meta: { title: "OL 全栈学习首页" } },
          ...createLessonRoutes(olFullstackLessons),
        ],
      },
      {
        path: "cesium-demo", name: "CesiumDemo", redirect: "/cesium-demo", meta: { title: "Cesium 前端 Demo", icon: "Camera" },
        children: [
          { path: "", name: "CesiumLearningHome", component: () => import("@/pages/cesium-frontend-demo/index.vue"), meta: { title: "Cesium 前端学习首页" } },
          ...createLessonRoutes(cesiumLessons),
        ],
      },
      {
        path: "cesium-fullstack-demo", name: "CesiumFullstackDemo", redirect: "/cesium-fullstack-demo", meta: { title: "Cesium 全栈 Demo", icon: "Connection" },
        children: [
          { path: "", name: "CesiumFullstackHome", component: () => import("@/pages/cesium-fullstack-demo/index.vue"), meta: { title: "Cesium 全栈学习首页" } },
          ...createLessonRoutes(cesiumFullstackLessons),
        ],
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/404" },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  const token = getToken()
  if (to.path === "/login") return token ? "/" : true
  return token ? true : "/login"
})

export default router
export { routes }
