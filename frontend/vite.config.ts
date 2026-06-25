import { resolve } from "node:path"
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vitePluginCesium from "vite-plugin-cesium"
import type { Plugin } from "vite"

/** Mock 插件 — 拦截 /api/auth/* 请求，无需后端即可开发 */
function mockPlugin(): Plugin {
  return {
    name: "vite-mock-auth",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/auth")) return next()

        const body = await new Promise<string>((resolve) => {
          let data = ""
          req.on("data", (chunk) => { data += chunk })
          req.on("end", () => resolve(data))
        })

        const json = (data: unknown) => {
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.statusCode = 200
          res.end(JSON.stringify(data))
        }

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

        if (req.method === "GET" && req.url === "/api/auth/me") {
          json({
            code: 200,
            message: "success",
            data: { username: "admin", roles: ["admin"] }
          })
          return
        }

        next()
      })
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      },
      "/geoserver": {
        target: "http://localhost:8081",
        changeOrigin: true
      }
    },
    cors: true
  },
  build: {
    chunkSizeWarningLimit: 2048
  },
  plugins: [
    vitePluginCesium(),
    mockPlugin(),
    vue()
  ]
})
