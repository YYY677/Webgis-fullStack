# 静态演示登录与后端状态实现计划

> **面向 AI 代理的工作者：** 使用测试优先方式执行以下任务。

**目标：** 让 GitHub Pages 使用前端 mock 登录，并以全局状态位和友好提示反映后端连通性，不改动任何全栈教学页面内部内容。

**架构：** `auth.ts` 在 mock 模式下直接构造认证结果；后端状态模块以 `/api/health` 为本地探测端点，或使用显式远程 API 地址。布局和首页订阅同一状态；请求层在后端不可用时拒绝业务 API，避免静态站点返回 405。

**技术栈：** Vue 3、Vitest、Axios、Spring Security。

---

### 任务 1：认证模式与 mock 响应

**文件：**
- 新建：`frontend/src/api/auth-mode.ts`
- 新建：`frontend/src/api/auth-mode.test.ts`
- 修改：`frontend/src/api/auth.ts`
- 修改：`frontend/vite.config.ts`

- [ ] 先为默认 mock 模式、显式 remote 模式及 mock 登录结果写失败测试。
- [ ] 在 `auth-mode.ts` 实现环境解析与 mock 认证数据工厂。
- [ ] 让 `auth.ts` 在 mock 模式绕过 Axios，在 remote 模式继续调用真实后端。
- [ ] 移除仅供 Vite 开发服务器使用的 `mockPlugin`，确保认证 mock 只有一个实现来源。

### 任务 2：后端探测与请求保护

**文件：**
- 新建：`frontend/src/services/backend-status.ts`
- 新建：`frontend/src/services/backend-status.test.ts`
- 修改：`frontend/src/api/request.ts`
- 修改：`frontend/src/main.ts`
- 修改：`frontend/src/env.d.ts`

- [ ] 先为静态演示、健康检查成功、健康检查失败、全栈路由识别写失败测试。
- [ ] 实现后端状态单例：启动即查、30 秒轮询、浏览器恢复在线或重新可见时重查。
- [ ] 在请求层阻止未连接后端时的业务 API，并返回明确的不可用错误而非发往 GitHub Pages。
- [ ] 在应用启动时开始监测；环境变量可选支持未来远程 API 地址而不修改现有 `.env`。

### 任务 3：复用现有状态位与路由触发

**文件：**
- 修改：`frontend/src/layout/AtlasLayout.vue`
- 修改：`frontend/src/pages/dashboard/DashboardAtlas.vue`
- 修改：`frontend/src/router/index.ts`

- [ ] 让左下角全局状态位展示检测中、后端已连接、后端未连接或静态演示。
- [ ] 让首页右上角展示同一后端状态摘要。
- [ ] 进入 `ol-fullstack-demo` 或 `cesium-fullstack-demo` 时立即重查；仅在当前状态不可用时显示一次全局提示。
- [ ] 不修改全栈页面内部模板、业务按钮或数据加载逻辑。

### 任务 4：后端跨域兼容与验证

**文件：**
- 修改：`backend/src/main/java/com/webgis/config/SecurityConfig.java`
- 测试：`frontend/src/api/auth-mode.test.ts`
- 测试：`frontend/src/services/backend-status.test.ts`

- [ ] 为本地 Vite 与 GitHub Pages 来源配置 CORS，使未来远程后端可被前端健康检查和 API 调用访问。
- [ ] 运行新增前端测试、完整前端测试、生产构建和后端编译测试。
