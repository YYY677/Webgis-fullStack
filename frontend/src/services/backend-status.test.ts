import { describe, expect, it, vi } from "vitest"
import { createBackendMonitor, isFullstackRoute, resolveBackendHealthUrl } from "./backend-status"

describe("后端健康检查地址", () => {
  it("本地开发默认通过 Vite 代理检查 /api/health", () => {
    expect(resolveBackendHealthUrl({ DEV: true })).toBe("/api/health")
  })

  it("静态演示版未配置远程 API 时不发起无效检查", () => {
    expect(resolveBackendHealthUrl({ PROD: true })).toBeUndefined()
  })

  it("远程 API 地址自动派生健康检查地址", () => {
    expect(resolveBackendHealthUrl({ VITE_API_BASE_URL: "https://api.example.com/api/" }))
      .toBe("https://api.example.com/api/health")
  })
})

describe("后端状态监测", () => {
  it("健康检查成功后标记为 online", async () => {
    const requestHealth = vi.fn().mockResolvedValue(true)
    const monitor = createBackendMonitor({ healthUrl: "/api/health", requestHealth })

    await monitor.checkNow()

    expect(monitor.status.value).toBe("online")
    expect(requestHealth).toHaveBeenCalledWith("/api/health")
  })

  it("健康检查失败后标记为 offline", async () => {
    const monitor = createBackendMonitor({ healthUrl: "/api/health", requestHealth: async () => false })

    await monitor.checkNow()

    expect(monitor.status.value).toBe("offline")
  })

  it("没有健康检查地址时标记为 unconfigured", async () => {
    const monitor = createBackendMonitor({ healthUrl: undefined, requestHealth: async () => true })

    await monitor.checkNow()

    expect(monitor.status.value).toBe("unconfigured")
  })
})

describe("全栈模块路由", () => {
  it("识别 OpenLayers 与 Cesium 全栈模块", () => {
    expect(isFullstackRoute("/ol-fullstack-demo/spatial-editor")).toBe(true)
    expect(isFullstackRoute("/cesium-fullstack-demo/server-analysis")).toBe(true)
  })

  it("不把纯前端模块当成后端依赖模块", () => {
    expect(isFullstackRoute("/ol-frontend-demo/load-data")).toBe(false)
  })
})
