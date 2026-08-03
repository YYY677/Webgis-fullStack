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
import type { Plugin } from "vite"

/** Mock 插件 — 拦截 /api/auth/* 请求，无需后端即可开发 */
// 仅开发环境使用的模拟认证插件：后端未启动时也能完成登录演示。
function mockPlugin(): Plugin {
  return {
    // Vite 用该名称区分和调试插件。
    name: "vite-mock-auth",
    // configureServer 仅在开发服务器启动时执行，可在此注册中间件。
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 只接管认证接口；其他请求继续交给 Vite 或后续中间件处理。
        if (!req.url?.startsWith("/api/auth")) return next()

        // 将 POST 请求的数据流拼接为字符串，供登录接口读取账号信息。
        const body = await new Promise<string>((resolve) => {
          let data = ""
          req.on("data", (chunk) => { data += chunk })
          req.on("end", () => resolve(data))
        })

        // 统一返回项目约定的 JSON 响应结构。
        const json = (data: unknown) => {
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.statusCode = 200
          res.end(JSON.stringify(data))
        }

        // 模拟登录：读取提交的用户名，并返回一个仅供本地开发使用的 token。
        if (req.method === "POST" && req.url === "/api/auth/login") {
          let parsed: any = {}
          try { parsed = JSON.parse(body) } catch {}
          json({
            code: 200,
            message: "success",
            data: {
              token: "mock-token-admin",
              username: parsed.username || "admin",
              displayName: "管理员",
              role: "admin"
            }
          })
          return
        }

        // 模拟获取当前用户：登录后前端会用此接口读取用户名和角色。
        if (req.method === "GET" && req.url === "/api/auth/me") {
          json({
            code: 200,
            message: "success",
            data: { username: "admin", roles: ["admin"] }
          })
          return
        }

        // 未定义的认证子路径继续传递，避免插件吞掉无关请求。
        next()
      })
    }
  }
}

export default defineConfig(({ command }) => ({
  // command 是 Vite 的运行模式，值为 "serve" 或 "build"。
  // GitHub Pages 部署时，Vite 的 base 配置必须是仓库名，否则资源路径会出错。
  base: command === "build" ? "/Webgis-fullStack/" : "/",
  
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
    mockPlugin(),
    // 生成 Vue 3 图标组件，供 ~icons/tabler/... 导入使用。
    Icons({ compiler: "vue3" }),
    // 编译 .vue 文件，Vue 项目的基础插件。
    vue()
  ]
}))
