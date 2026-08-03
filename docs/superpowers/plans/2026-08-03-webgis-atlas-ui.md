# WebGIS Atlas UI 实现计划

> **目标：** 在不改动四个学习组内部内容的前提下，完成登录页、dashboard 和应用外壳的深海测绘台视觉改造。

**架构：** 保持现有 Vue Router、Pinia、Element Plus 与页面层级。新增 Motion 全局指令与 Tabler 图标按需编译；将 dashboard 的入口卡片数据保留在页面内，通过现有路径跳转。

**技术栈：** Vue 3、Vite、Element Plus、`@vueuse/motion`、`unplugin-icons`、Tabler Iconify 数据。

---

### 任务 1：接入视觉依赖和应用级 token

**文件：**
- 修改：`frontend/package.json`
- 修改：`frontend/package-lock.json`
- 修改：`frontend/vite.config.ts`
- 修改：`frontend/src/main.ts`
- 修改：`frontend/src/styles/variables.css`
- 修改：`frontend/src/styles/index.scss`

- [ ] 安装 `@vueuse/motion` 作为运行时依赖。
- [ ] 安装 `unplugin-icons`、`@iconify-json/tabler` 作为开发依赖。
- [ ] 在 Vite 注册 Vue 3 图标编译插件，在应用注册 `MotionPlugin`。
- [ ] 定义深海测绘 token、暗色 Element Plus 覆盖及 reduced-motion 规则。

### 任务 2：重构登录页与 dashboard

**文件：**
- 修改：`frontend/src/pages/login/index.vue`
- 修改：`frontend/src/pages/dashboard/index.vue`

- [ ] 以原有登录 API 与跳转逻辑为边界，替换登录页布局和样式。
- [ ] 用空间态势区、系统状态和四个既有组首页入口替换 dashboard 空白内容。
- [ ] 为入口卡片与登录表单添加克制的 Motion 入场与悬停反馈。

### 任务 3：统一应用外壳

**文件：**
- 修改：`frontend/src/layout/MainLayout.vue`

- [ ] 保持既有菜单计算、搜索、主题、全屏和退出登录逻辑。
- [ ] 只替换侧栏、顶栏、页脚和搜索弹窗的视觉样式与图标呈现。
- [ ] 保证折叠侧栏和小屏幕状态不溢出。

### 任务 4：验证

**文件：**
- 验证：`frontend/src/pages/login/index.vue`
- 验证：`frontend/src/pages/dashboard/index.vue`
- 验证：`frontend/src/layout/MainLayout.vue`

- [ ] 运行 `npm run build`，确认类型检查和生产构建成功。
- [ ] 启动前端，使用浏览器检查登录、登录跳转、dashboard 四个入口、主题切换与小屏幕布局。
- [ ] 对比设计预览与实际截图，修复明显的层级、对比度、溢出或动效问题。
