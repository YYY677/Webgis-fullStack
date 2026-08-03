import { readonly, ref } from "vue"

export type BackendStatus = "checking" | "online" | "offline" | "unconfigured"

type RuntimeEnvironment = {
  DEV?: boolean
  PROD?: boolean
  VITE_API_BASE_URL?: string
  VITE_BACKEND_HEALTH_URL?: string
}

type HealthRequest = (url: string) => Promise<boolean>

interface BackendMonitorOptions {
  healthUrl?: string
  requestHealth: HealthRequest
}

export const BACKEND_CHECK_INTERVAL = 30_000

export const backendStatusInfo: Record<BackendStatus, { label: string; tone: string }> = {
  checking: { label: "后端检测中", tone: "checking" },
  online: { label: "后端已连接", tone: "online" },
  offline: { label: "后端未连接", tone: "offline" },
  unconfigured: { label: "静态演示模式", tone: "unconfigured" },
}

function appendHealthPath(apiBaseUrl: string) {
  return `${apiBaseUrl.replace(/\/+$/, "")}/health`
}

/** 生产环境只有配置了远程 API 地址时才探测，避免 Pages 反复请求自身的 /api。 */
export function resolveBackendHealthUrl(environment: RuntimeEnvironment) {
  const explicitUrl = environment.VITE_BACKEND_HEALTH_URL?.trim()
  if (explicitUrl) return explicitUrl

  const remoteApiBaseUrl = environment.VITE_API_BASE_URL?.trim()
  if (remoteApiBaseUrl) return appendHealthPath(remoteApiBaseUrl)

  return environment.DEV ? "/api/health" : undefined
}

export function isFullstackRoute(path: string) {
  return path.startsWith("/ol-fullstack-demo") || path.startsWith("/cesium-fullstack-demo")
}

export function createBackendMonitor({ healthUrl, requestHealth }: BackendMonitorOptions) {
  const status = ref<BackendStatus>(healthUrl ? "checking" : "unconfigured")
  let timer: number | undefined

  async function checkNow() {
    if (!healthUrl) {
      status.value = "unconfigured"
      return status.value
    }

    status.value = await requestHealth(healthUrl) ? "online" : "offline"
    return status.value
  }

  function checkWhenVisible() {
    if (document.visibilityState === "visible") void checkNow()
  }

  function start() {
    void checkNow()
    if (typeof window === "undefined" || timer !== undefined) return

    timer = window.setInterval(() => void checkNow(), BACKEND_CHECK_INTERVAL)
    window.addEventListener("online", checkNow)
    document.addEventListener("visibilitychange", checkWhenVisible)
  }

  function stop() {
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
    window.removeEventListener("online", checkNow)
    document.removeEventListener("visibilitychange", checkWhenVisible)
  }

  return { status: readonly(status), checkNow, start, stop }
}

async function requestHealth(url: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return false
    const payload = await response.json() as { code?: number; data?: { status?: string } }
    return payload.code === 200 && payload.data?.status === "UP"
  } catch {
    return false
  } finally {
    window.clearTimeout(timeout)
  }
}

const monitor = createBackendMonitor({
  healthUrl: resolveBackendHealthUrl(import.meta.env),
  requestHealth,
})

export const backendStatus = monitor.status
export const checkBackendNow = monitor.checkNow

export function startBackendMonitoring() {
  monitor.start()
}

export function canRequestBackend() {
  return backendStatus.value === "checking" || backendStatus.value === "online"
}

export function backendUnavailableMessage() {
  return backendStatus.value === "unconfigured"
    ? "当前为静态演示模式，后端功能不可用。"
    : "后端未连接，当前功能不可用。"
}
