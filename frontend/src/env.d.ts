/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_BASE_URL: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BACKEND_HEALTH_URL?: string
  readonly VITE_AUTH_MODE?: "mock" | "remote"
  readonly VITE_TIANDITU_KEY: string
  readonly VITE_CESIUM_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
