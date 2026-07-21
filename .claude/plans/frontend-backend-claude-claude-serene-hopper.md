# 更新 CLAUDE.md 计划

## Context

项目三份 CLAUDE.md 文件（根目录、frontend、backend）均已久未更新，内容多处与当前代码状态不符（拼写错误、版本号过时、模块标记为"待实现"但实际已完成等）。用户选择了**精简更新**模式——修补明显过时的部分，保持现有骨架。

## 变更清单

### 1. 根目录 `CLAUDE.md`

| 问题 | 修复 |
|------|------|
| "componets" 拼写错误 | → "components" |
| 前端分层说明指向 `backend/CLAUDE.md` | → 指向 `frontend/CLAUDE.md` 或 `frontend/AGENTS.md` |
| Element Plus 状态写"后续安装" | → 标注已安装版本 (^2.13.1) |
| Vite 版本列 "~6.0 / 8.0.8" 错误 | → 实际 ^7.3.1 |
| 前端目录结构 `composables/componets/views/stores/api` 过时 | → 更新为实际结构：`api/router/stores/layout/composables/utils/styles/pages/assets/components/plugins/types` |
| 技术栈表缺少 echarts (^6.1.0) | → 可以不加（非核心依赖），保持精简 |
| 语言：用户要求中文 | 已是中文，无需更改 |
| Docker 部分标注"(后续)" | 项目仍无 docker-compose，保留不变 |

### 2. `frontend/CLAUDE.md` 及 `frontend/AGENTS.md`

- `frontend/CLAUDE.md` 当前为 `@AGENTS.md`（一行委托），模式合理，保留
- `frontend/AGENTS.md` 需要更新：
  - 目录结构缺少 `components/`、`plugins/`、`types/` 目录
  - 可补充关键组件说明（BasemapSwitcher、LayerControl、StyleManager 等）
  - 补充 Cesium 相关内容（已有 cesium-frontend-demo 页面）
  - 补充后端联动的页面组（ol-backend-demo 六个页面）

### 3. `backend/CLAUDE.md`

| 问题 | 修复 |
|------|------|
| spatial/geoserver/file 模块标记"(待实现)" | → 标注"已实现"并更新实际模块结构 |
| 数据库名写 `webgis`，实际配置为 `webgistest` | → 改为 `webgistest` |
| "为什么不放一起" 缺字 | → "为什么**不放在一起**" |
| "contoller" 拼写错误 | → "controller" |
| 模块目录图缺少 geoserver 的子包（config/client/style/dto/web） | → 补充完整结构 |
| API 端点列表不全（缺 spatial/analysis/**、geoserver/styles/** 等） | → 补充实际端点 |
| 缺少 SpatialAnalysisService (JTS + pgRouting) 说明 | → 补充 |

## 执行方案

每份文件的修改可独立并行执行：

1. **根 CLAUDE.md** — Edit 逐项修复
2. **frontend/AGENTS.md** — Edit 补充目录和说明
3. **backend/CLAUDE.md** — Edit 逐项修复

## 验证

修改完成后：
- 目视检查每份文件的格式与内容一致性
- `git diff` 确认变更范围符合预期
- 展示 diff 给用户确认后再 commit
