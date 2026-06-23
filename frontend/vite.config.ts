/// <reference types="vitest/config" />

import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import UnoCSS from "unocss/vite"
import AutoImport from "unplugin-auto-import/vite"
import SvgComponent from "unplugin-svg-component/vite"
import { ElementPlusResolver } from "unplugin-vue-components/resolvers"
import Components from "unplugin-vue-components/vite"
import { defineConfig, loadEnv } from "vite"
import type { Plugin } from "vite"
import vitePluginCesium from "vite-plugin-cesium"
import { ViteMcp } from "vite-plugin-mcp"
import svgLoader from "vite-svg-loader"

/**
 * Mock 插件 — 开发环境拦截 /api/auth/* 请求，无需后端
 * body 解析基于标准的 connect 中间件
 */
function mockPlugin(): Plugin {
  return {
    name: "vite-mock-auth",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 只处理 /api/auth 请求，其余交给代理
        if (!req.url?.startsWith("/api/auth")) return next()

        // 解析请求体
        const body = await new Promise<string>((resolve) => {
          let data = ""
          req.on("data", (chunk) => { data += chunk })
          req.on("end", () => resolve(data))
        })

        const json = () => {
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.statusCode = 200
        }

        if (req.method === "POST" && req.url === "/api/auth/login") {
          let parsed: any = {}
          try { parsed = JSON.parse(body) } catch {}
          json()
          res.end(JSON.stringify({
            code: 200,
            message: "success",
            data: {
              token: "mock-token-admin",
              username: parsed.username || "admin",
              displayName: "管理员",
              role: "admin"
            }
          }))
          return
        }

        if (req.method === "GET" && req.url === "/api/auth/me") {
          json()
          res.end(JSON.stringify({
            code: 200,
            message: "success",
            data: {
              username: "admin",
              roles: ["admin"]
            }
          }))
          return
        }

        next()
      })
    }
  }
}

// Configuring Vite: https://cn.vite.dev/config
export default defineConfig(({ mode }) => {
  const { VITE_PUBLIC_PATH } = loadEnv(mode, process.cwd(), "") as ImportMetaEnv
  return {
    // 开发或打包构建时用到的公共基础路径
    base: VITE_PUBLIC_PATH,
    resolve: {
      alias: {
        // @ 符号指向 src 目录
        "@": resolve(__dirname, "src"),
        // @@ 符号指向 src/common 通用目录
        "@@": resolve(__dirname, "src/common")
      }
    },
    // 开发环境服务器配置
    server: {
      // 是否监听所有地址
      host: true,
      // 端口号
      port: 5173,
      // 端口被占用时，是否直接退出
      strictPort: false,
      // 是否自动打开浏览器
      open: false,
      // 反向代理
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          ws: false,
          changeOrigin: true
        },
        "/geoserver": {
          target: "http://localhost:8081",
          ws: false,
          changeOrigin: true
        }
      },
      // 是否允许跨域
      cors: true,
      // 预热常用文件，提高初始页面加载速度
      warmup: {
        clientFiles: [
          "./src/layouts/**/*.*",
          "./src/pinia/**/*.*",
          "./src/router/**/*.*"
        ]
      }
    },
    // 构建配置
    build: {
      // 自定义底层的 Rollup 打包配置
      rollupOptions: {
        output: {
          /**
           * @name 分块策略
           * @description 1. 注意这些包名必须存在，否则打包会报错
           * @description 2. 如果你不想自定义 chunk 分割策略，可以直接移除这段配置
           */
          manualChunks: {
            vue: ["vue", "vue-router", "pinia"],
            element: ["element-plus", "@element-plus/icons-vue"],
            vxe: ["vxe-table"]
          }
        }
      },
      // 是否开启 gzip 压缩大小报告，禁用时能略微提高构建性能
      reportCompressedSize: false,
      // 单个 chunk 文件的大小超过 2048kB 时发出警告
      chunkSizeWarningLimit: 2048
    },
    // 混淆器
    esbuild:
      mode === "development"
        ? undefined
        : {
            // 打包构建时移除 console.log
            pure: ["console.log"],
            // 打包构建时移除 debugger
            drop: ["debugger"],
            // 打包构建时移除所有注释
            legalComments: "none"
          },
    // 依赖预构建
    optimizeDeps: {
      include: ["element-plus/es/components/*/style/css"]
    },
    // CSS 相关配置
    css: {
      // 线程中运行 CSS 预处理器
      preprocessorMaxWorkers: true
    },
    // 插件配置
    plugins: [
      vitePluginCesium(),
      mockPlugin(),
      vue(),
      // 支持将 SVG 文件导入为 Vue 组件
      svgLoader({
        defaultImport: "url",
        svgoConfig: {
          plugins: [
            {
              name: "preset-default",
              params: {
                overrides: {
                  // @see https://github.com/svg/svgo/issues/1128
                  removeViewBox: false
                }
              }
            }
          ]
        }
      }),
      // 自动生成 SvgIcon 组件和 SVG 雪碧图
      SvgComponent({
        iconDir: [resolve(__dirname, "src/common/assets/icons")],
        preserveColor: resolve(__dirname, "src/common/assets/icons/preserve-color"),
        dts: true,
        dtsDir: resolve(__dirname, "types/auto")
      }),
      // 原子化 CSS
      UnoCSS(),
      // 自动按需导入 API
      AutoImport({
        imports: ["vue", "vue-router", "pinia"],
        dts: "types/auto/auto-imports.d.ts",
        resolvers: [ElementPlusResolver()]
      }),
      // 自动按需导入组件
      Components({
        dts: "types/auto/components.d.ts",
        resolvers: [ElementPlusResolver()]
      }),
      // 为项目开启 MCP Server
      ViteMcp()
    ],
    // Configuring Vitest: https://cn.vitest.dev/config
    test: {
      include: ["tests/**/*.test.{ts,js}"],
      environment: "happy-dom",
      server: {
        deps: {
          inline: ["element-plus"]
        }
      }
    }
  }
})
