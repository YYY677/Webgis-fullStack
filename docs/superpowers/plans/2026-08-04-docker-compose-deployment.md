# Docker Compose 部署实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 WebGIS 前端、后端、PostGIS 和 GeoServer 建立可重复部署的 Docker Compose 流程。

**架构：** Compose 使用 `postgres-data` 与 `geoserver-data` 两个命名卷。PostGIS 官方入口脚本只在空数据库卷导入 SQL；GeoServer 初始化容器只在空目录卷解压完整 Data Directory；PowerShell 同步容器等 GeoServer 可用后通过仓库同步包把 catalogue 连接改为 Compose 内的 `db`。

**技术栈：** Docker Compose、PostgreSQL 17、PostGIS 3.5、pgRouting 3.7.3、GeoServer 2.26.1、Spring Boot 3.5/Java 17、Vue/Vite、Nginx、PowerShell 7。

---

## 文件结构

- 创建：`deploy/compose.yaml` — 四个常驻服务与两个一次性初始化服务。
- 创建：`deploy/.env.example`、`deploy/.gitignore` — 运维变量模板和真实变量忽略规则。
- 创建：`deploy/README.md` — 首次部署、日常启动、强制同步、备份和故障处理。
- 创建：`deploy/geoserver/Dockerfile.init`、`deploy/geoserver/init-data-dir.sh` — 空卷时解压 Data Directory ZIP。
- 创建：`deploy/geoserver/Dockerfile.sync`、`deploy/geoserver/sync-catalog.ps1` — 等待 GeoServer，按标记执行 REST 同步。
- 创建：`backend/Dockerfile`、`backend/.dockerignore` — Java 17 多阶段镜像。
- 创建：`frontend/Dockerfile`、`frontend/.dockerignore`、`frontend/nginx/default.conf` — Vite 构建和 Nginx 反向代理镜像。
- 修改：`frontend/vite.config.ts` — 支持 Docker 构建时传入根路径，保持 GitHub Pages 默认路径不变。

### 任务 1：创建初始化容器与 Compose 编排

- [ ] 编写 GeoServer Data Directory 空卷保护脚本：目录存在 `global.xml` 时跳过；目录非空但不完整时失败；否则解压 ZIP 并赋予 GeoServer 容器用户读写权限。
- [ ] 编写 catalog 同步脚本：等待 REST 状态接口、读取环境变量构造 `PSCredential`、调用现有 `geoserver/apply.ps1`、成功后写入同步标记。
- [ ] 编写 Compose：PostGIS SQL 初始化挂载、GeoServer 数据目录命名卷、服务依赖和仅前端端口映射。

### 任务 2：创建前后端镜像与 Nginx 入口

- [ ] 编写后端 Maven 构建与 JRE 运行镜像，运行时监听 8080。
- [ ] 编写前端 Node 构建与 Nginx 运行镜像，保留 Cesium 构建脚本产物。
- [ ] 编写 Nginx：SPA 回退、`/api/` 到后端、`/geoserver/` 到 GeoServer、上传大小与代理请求头。
- [ ] 修改 Vite base：只有 Docker 传入 `VITE_DEPLOY_BASE` 时使用该值，未传入时维持现有 GitHub Pages 行为。

### 任务 3：文档、配置模板与验证

- [ ] 提供不含真实密码的环境变量模板和忽略规则。
- [ ] 在部署 README 中说明首次启动、访问地址、强制同步、数据库/Data Directory 备份和卷重置风险。
- [ ] 运行 `docker compose --env-file deploy/.env.example -f deploy/compose.yaml config` 验证 Compose 插值与 YAML。
- [ ] 在本机可用的前后端工具链上运行针对改动的类型检查或构建；若 Docker 未安装，明确报告该限制。
