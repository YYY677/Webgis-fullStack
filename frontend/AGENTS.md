# 原则

- 简洁优先：不添加要求之外的功能
- 嵌套不超过 2-3 层目录，每个功能一个文件搞定
- 修改前端代码后向用户解释改动

# 命令

```bash
npm run dev      # 启动开发服务器 :5173
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物
```

# 技术栈

Vue 3.5 + TypeScript + Vite 7 + Element Plus + OpenLayers + CesiumJS

# 目录结构

```
src/
├── api/          # 接口请求
├── router/       # 路由表 + 守卫
├── stores/       # Pinia 状态管理
├── layout/       # 布局组件
├── composables/  # 组合式函数
├── utils/        # 工具函数
├── styles/       # SCSS 样式
├── pages/        # 页面
└── assets/       # 静态资源
```

# 本项目定制

- **Mock 登录**: `vite.config.ts` 中的 `mockPlugin()` 拦截 `/api/auth/*`，无需后端即可登录
- **响应码**: axios 拦截器以 `code === 200` 为成功
- **Vite 代理**: 开发时 `/api` → `localhost:8080`, `/geoserver` → `localhost:8081`
- **侧边栏菜单**: 定义在 `layout/MainLayout.vue` 的 `menuList` 数组中
- **主题切换**: Element Plus 原生暗黑模式，`html.dark` class 控制
