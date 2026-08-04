# 项目文档刷新实施计划

> **面向执行者：** 本计划只更新 Markdown 上下文与操作说明；不改动应用代码、数据库、GeoServer 实例或已暂存的备份内容。

**目标：** 让仓库根目录、GeoServer、前端和后端的文档反映当前项目结构，并提供可从零启动本地环境的说明。

**范围：** 以当前仓库的真实 `package.json`、`pom.xml`、路由、控制器、`geoserver/config` 和 GeoServer Data Directory 备份为准；文档不记录真实密码或令牌。

---

## 文件职责

| 文件 | 本次职责 |
| --- | --- |
| `README.md` | 面向开发者的项目概览、依赖、首次启动、服务顺序和入口说明。 |
| `geoserver/README.md` | GeoServer Data Directory 备份和 REST 配置同步包的边界、使用流程和风险说明。 |
| `AGENTS.md` | 根级技术事实与跨服务架构约定。 |
| `frontend/AGENTS.md` | 前端实际结构、路由学习模块、命令和后端依赖约定。 |
| `backend/CLAUDE.md` | 后端模块与为 Cesium 全栈演示提供的接口关系。 |

## 执行步骤

1. 修订 `geoserver/README.md`：把遗留的 `infra/geoserver` 路径替换为实际 `geoserver` 路径；解释 `GeoServer.zip` 与 REST 配置包的不同用途，列出安全与缓存风险。
2. 新建根目录 `README.md`：按“项目是什么、架构、依赖、首次启动、启动顺序、访问入口、目录索引、常见排查”组织内容；命令必须对应现有脚本和端口。
3. 更新根目录 `AGENTS.md`：同步 Vite、GeoServer 版本和 2D/3D 数据流描述。
4. 更新 `frontend/AGENTS.md`：将 Cesium 课程更新为 19 个纯前端页面和 3 个全栈页面，更新布局组件、脚本和接口依赖。
5. 更新 `backend/CLAUDE.md`：补充 Cesium 全栈复用的 GeoServer、空间 CRUD 与空间分析接口；不虚构新的后端模块。
6. 核验：检查文档内引用路径存在，确认命令与 `frontend/package.json`、`backend/pom.xml` 一致，并运行 GeoServer 配置包现有 Pester 测试。

## 完成标准

- README 能让新开发者按顺序启动 PostgreSQL/PostGIS、GeoServer、后端与前端。
- GeoServer 文档不再引用 `infra/geoserver`，并明确 ZIP 备份不能替代可审查配置包。
- 上下文文档的版本、页面数量、布局和服务接口均能在当前代码中找到依据。
