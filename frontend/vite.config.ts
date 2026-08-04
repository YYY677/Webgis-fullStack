// Node.js 路径工具：用于把 @ 别名解析到 src 目录。
import { resolve } from "node:path"
// Vite 配置的类型辅助函数，提供配置项的 TypeScript 提示。
import { defineConfig } from "vite"
// 让 Vite 能编译 Vue 单文件组件（.vue）。
import vue from "@vitejs/plugin-vue"
// 自动处理 Cesium 运行所需的 Worker、静态资源等。
import vitePluginCesium from "vite-plugin-cesium"
// 在构建时把 ~icons/tabler/search 这类虚拟导入转换为 Vue SVG 组件。
import Icons from "unplugin-icons/vite"
// 自定义 Vite 插件返回对象的 TypeScript 类型。
export default defineConfig(({ command }) => ({
  // command 是 Vite 的运行模式，值为 "serve" 或 "build"。
  // 默认保留 GitHub Pages 的仓库子路径；Docker 部署可在构建时传 VITE_DEPLOY_BASE=/，
  // 使 Nginx 从站点根路径提供所有静态资源。
  base: command === "build" ? process.env.VITE_DEPLOY_BASE || "/Webgis-fullStack/" : "/",
  
  // 模块解析规则：@/pages/... 等同于 src/pages/...
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  // 仅 npm run dev 生效的开发服务器配置。
  server: {
    // 本地前端访问地址：http://localhost:5173
    port: 5173,
    // 启动开发服务器时不自动打开浏览器。
    open: false,
    // 将前端请求转发到本地服务，避免开发时出现跨域问题。
    proxy: {
      "/api": {
        // Spring Boot 后端。
        target: "http://localhost:8080",
        changeOrigin: true
      },
      "/geoserver": {
        // GeoServer 地图服务。
        target: "http://localhost:8081",
        changeOrigin: true
      }
    },
    // 开发服务器允许跨域访问。
    cors: true
  },
  // 生产构建相关配置。
  build: {
    // 单个打包文件超过 2048 KB 才输出体积警告；Cesium 等依赖较大，因此提高默认阈值。
    chunkSizeWarningLimit: 2048
  },
  // Vite 插件按数组顺序注册；每一项都是“为编译/开发服务器增加能力”的插件。
  plugins: [
    // 处理 Cesium 的资源拷贝与运行环境。
    vitePluginCesium(),
    // 拦截 /api/auth/*，返回本地模拟登录响应。
    // 生成 Vue 3 图标组件，供 ~icons/tabler/... 导入使用。
    Icons({ compiler: "vue3" }),
    // 编译 .vue 文件，Vue 项目的基础插件。
    vue()
  ]
}))
