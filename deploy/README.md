# WebGIS Docker 部署说明

本目录将 Vue 前端、Spring Boot 后端、PostgreSQL/PostGIS/pgRouting 与 GeoServer 部署到一台 Linux 虚拟机或服务器。默认通过 `http://<服务器 IP>` 访问，不要求域名或 HTTPS。

## 服务关系

```text
浏览器
  -> frontend:80（Nginx，对外唯一端口）
       -> /api        -> backend:8080
       -> /geoserver  -> geoserver:8080
                              -> db:5432
```

不要为 `db`、`backend` 或 `geoserver` 映射宿主机端口。浏览器只访问 Nginx，因此 GeoServer 管理密码不会交给前端。Nginx 阻断 `/geoserver/rest`，但保留需登录的 `/geoserver/web` 管理后台；公网部署时应再加 IP 白名单。

## 首次初始化做什么

执行 `docker compose up` 时，Compose 按以下顺序工作：

1. `db` 创建空的 `postgres-data` 卷，并由 PostgreSQL 官方初始化逻辑导入 `data/webgistest-2026-08-03.sql`。
2. `geoserver-data-init` 检查 `geoserver-data`。空卷时解压 `geoserver/GeoServer.zip`；目录已经含 `global.xml` 时直接跳过。
3. `geoserver` 以 2.26.1 启动，并挂载上述完整 Data Directory。
4. `catalog-sync` 等待 GeoServer REST 可用，调用已有的 `geoserver/apply.ps1`。它将 ZIP 中原来的 PostGIS 主机 `localhost` 改为 Compose 服务名 `db`，并同步 `geoserver/config` 中受版本控制的 workspace、图层和 SLD。
5. `catalog-sync` 在 Data Directory 写入 `.webgis-catalog-synced` 标记；之后普通重启不会再导入或覆盖 GeoServer 配置。
6. `backend` 启动并连接 `db` 与 `geoserver`；`frontend` 由 Nginx 对外提供。

## 前提

- Linux 虚拟机或服务器已安装 Docker Engine 和 Docker Compose v2。
- 当前用户能运行 `docker`；使用 `WEBGIS_HTTP_PORT=80` 时通常需要 root 或已加入 docker 组。
- 虚拟机网络已允许宿主机或局域网访问该端口。VirtualBox/VMware 的 NAT 模式需设置端口转发；桥接模式可直接用虚拟机 IP。
- 至少预留约 6 GB 磁盘空间，首次构建需要下载 Maven、Node、GeoServer 与 PostGIS 镜像。

## 首次部署

在项目根目录执行：

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

至少修改以下项：

```dotenv
POSTGRES_PASSWORD=改成强密码
GEOSERVER_ADMIN_PASSWORD=填写 GeoServer.zip 中已有管理员密码
JWT_SECRET=改成长随机字符串
GEOSERVER_PROXY_BASE_URL=http://你的虚拟机IP/geoserver
```

如果端口 80 不可用，将其改为：

```dotenv
WEBGIS_HTTP_PORT=8088
```

然后构建并启动：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

查看首次初始化状态：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml logs -f geoserver-data-init catalog-sync
```

`geoserver-data-init` 与 `catalog-sync` 成功后会显示 `exited (0)`，这是一次性初始化服务的正常状态。

假设虚拟机 IP 是 `192.168.56.101`，且 `WEBGIS_HTTP_PORT=80`，访问：

```text
http://192.168.56.101/
http://192.168.56.101/api/health
http://192.168.56.101/geoserver/wms?service=WMS&request=GetCapabilities
```

若端口设为 `8088`，地址改为 `http://192.168.56.101:8088/`。

完整 Data Directory 自带 `security/`，所以 `GEOSERVER_ADMIN_USER` 和 `GEOSERVER_ADMIN_PASSWORD` 必须先填写 ZIP 中原有的管理员凭据；它们不会自动替换 ZIP 中的密码。需要修改 GeoServer 管理员密码时，请登录 `http://<虚拟机IP>/geoserver/web` 修改，并同步更新 `deploy/.env` 后重启 `backend` 与后续的 `catalog-sync` 命令。

## 日常启动与更新

停止但保留数据：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml down
```

重新启动：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d
```

代码更新后重建前后端镜像：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

上述命令不会重新导入 SQL、解压 ZIP 或重放 GeoServer 图层配置。

## 主动同步 GeoServer 图层和样式

在 Git 中修改 `geoserver/config` 下的 JSON 或 SLD 后，显式运行：

```bash
FORCE_CATALOG_SYNC=true docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm catalog-sync
```

该命令会按 `workspace -> datastore -> feature type -> style -> layer -> reload` 顺序调用 GeoServer REST API。样式 SLD 使用项目脚本规定的 UTF-8 和 `application/vnd.ogc.sld+xml` Content-Type。

若先在 GeoServer 后台修改了样式且希望将修改保留进 Git，请先在本机或可访问该 GeoServer 的环境运行 `geoserver/export.ps1`，审查 `geoserver/config` 差异后再提交；否则下一次强制同步会以 Git 中的配置覆盖它。

## 备份

先创建服务器本地备份目录：

```bash
mkdir -p backups
```

备份数据库：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db \
  pg_dump -U postgres -d webgistest > backups/webgistest-$(date +%F).sql
```

备份完整 GeoServer Data Directory（含 `security/`，应妥善保存）：

```bash
docker run --rm \
  -v webgis_geoserver-data:/source:ro \
  -v "$(pwd)/backups:/backup" \
  alpine:3.20 tar czf /backup/geoserver-data-$(date +%F).tar.gz -C /source .
```

Compose 文件固定项目名为 `webgis`，因此数据卷名固定为 `webgis_geoserver-data`。

## 重新初始化警告

以下命令会删除 PostgreSQL 与 GeoServer 的全部 Docker 卷，下一次启动会从 SQL 和 ZIP 重新恢复：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml down -v
```

仅在已有可用备份且明确希望丢弃当前容器数据时执行。

## 常见问题

### GeoServer 页面能打开但图层加载失败

检查同步日志与 datastore 主机：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml logs catalog-sync
docker compose --env-file deploy/.env -f deploy/compose.yaml logs geoserver
```

首次同步必须成功，`pg-webgistest` 的 host 应为 `db`，不能是 `localhost`。

### 访问虚拟机 IP 时 GetCapabilities 仍返回 localhost

修改 `deploy/.env` 中的 `GEOSERVER_PROXY_BASE_URL` 为真实 IP 和端口，再重启 GeoServer：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d geoserver
```

### 将来使用域名与 HTTPS

保持所有 Compose 服务不变，只修改 `frontend/nginx/default.conf`：将 `server_name _;` 换为域名，再增加监听 `443 ssl` 的 server 块并挂载证书。同时把 `GEOSERVER_PROXY_BASE_URL` 改为 `https://你的域名/geoserver`。
