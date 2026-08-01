import { describe, expect, it, vi } from "vitest"

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>()
  return {
    ...actual,
    createWebHashHistory: actual.createMemoryHistory,
  }
})

import { routes } from "./index"

describe("Cesium nested routes", () => {
  it("groups Cesium child pages under the main layout without a parent component", () => {
    const root = routes.find((route) => route.path === "/")
    const cesiumParent = root?.children?.find((route) => route.path === "cesium-demo")

    expect(cesiumParent?.component).toBeUndefined()
    expect(cesiumParent?.children?.map((route) => route.name)).toContain("CesiumLearningHome")
    expect(cesiumParent?.children?.map((route) => route.name)).toContain("CesiumMaterialEffects")
    expect(cesiumParent?.children?.map((route) => route.name)).not.toContain("CesiumLearningTopic")
    expect(cesiumParent?.children?.map((route) => route.name)).toEqual(expect.arrayContaining([
      "CesiumLayerManagement",
      "CesiumAnnotationEdit",
      "CesiumPerformanceLifecycle",
      "CesiumParticleSystem",
      "CesiumClippingFlood",
    ]))
  })

  it("derives every lesson breadcrumb title from the catalog", async () => {
    vi.resetModules()
    const { cesiumLessons } = await import("@/pages/cesium-frontend-demo/cesium-learning-catalog")
    const firstLesson = cesiumLessons[0]
    const originalTitle = firstLesson.title
    firstLesson.title = "01-目录驱动标题"

    try {
      const { routes: freshRoutes } = await import("./index")
      const root = freshRoutes.find((route) => route.path === "/")
      const cesiumParent = root?.children?.find((route) => route.path === "cesium-demo")
      const route = cesiumParent?.children?.find((child) => child.path === "cesium-entry")

      expect(route?.meta?.title).toBe(firstLesson.title)
    } finally {
      firstLesson.title = originalTitle
    }
  })
})
