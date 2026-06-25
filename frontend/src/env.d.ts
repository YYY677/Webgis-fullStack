/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_BASE_URL: string
  readonly VITE_TIANDITU_KEY: string
  readonly VITE_CESIUM_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
