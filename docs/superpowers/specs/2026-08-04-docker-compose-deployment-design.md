# Docker Compose 部署设计

## 目标

在单台 Linux 虚拟机或服务器上运行本项目，默认经 `http://<服务器 IP>` 访问。Compose 自动完成空卷首次初始化，后续重启不覆盖已有数据库、GeoServer Data Directory 或样式。

## 架构

```text
浏览器
  -> frontend（Nginx，唯一对外端口）
       -> /api        -> backend（Spring Boot）
       -> /geoserver  -> geoserver（WMS/WFS/WMTS）
                              -> db（PostgreSQL 17 + PostGIS + pgRouting）
```

`db`、`backend` 和 `geoserver` 只加入 Compose 内部网络，不暴露主机端口。前端 Nginx 监听 `${WEBGIS_HTTP_PORT:-80}`。

## 首次初始化与持久化

| 资源 | 来源 | 自动初始化条件 | 持久化位置 |
| --- | --- | --- | --- |
| PostgreSQL 数据 | `data/webgistest-2026-08-03.sql` | `postgres-data` 是新卷 | Docker named volume |
| GeoServer 完整目录 | `geoserver/GeoServer.zip` | `geoserver-data` 为空 | Docker named volume |
| GeoServer 目录配置 | `geoserver/config` | Data Directory 中不存在同步标记 | `geoserver-data/.webgis-catalog-synced` |

完整 Data Directory 中的 `pg-webgistest` 指向 `localhost:5432`。容器中 `localhost` 是 GeoServer 容器本身，所以第一次同步使用现有 `apply.ps1` 把 datastore 重写为 `db:5432`。同步包还会以受版本控制的 SLD、图层、feature type 和 workspace 定义覆盖 ZIP 中相同的目录配置。

同步完成后创建标记文件。日后若有意将 `geoserver/config` 的修改应用到正在运行的实例，使用 `FORCE_CATALOG_SYNC=true docker compose run --rm catalog-sync`；普通 `docker compose up -d` 不会重传配置。

## 版本选择

- PostgreSQL：SQL 文件由 PostgreSQL 17 导出且会创建 `pgrouting` 扩展，因此使用 `pgrouting/pgrouting:17-3.5-3.7.3`，同时固定 PostgreSQL 17、PostGIS 3.5 与 pgRouting 3.7.3。
- GeoServer：完整 Data Directory 来自本机 GeoServer 2.26.1，因此首次容器也固定为 `docker.osgeo.org/geoserver:2.26.1`，避免跨版本直接读取目录。
- Java：后端使用 Spring Boot 3.5 与 Java 17。

## 安全与配置原则

- 用户从 `deploy/.env.example` 复制出 `deploy/.env` 并自行填写密码、JWT 密钥及可公开的地图服务 Token；真实 `.env` 被忽略，不提交。
- GeoServer 管理员凭据来自完整 Data Directory，提供给 catalog-sync 和后端；不传给 GeoServer 容器，避免镜像重启时覆盖 `security/` 中后续新增的用户/角色。浏览器不接触该密码。
- Data Directory ZIP 含 `security/`，不得公开上传或提交到公共仓库。
- GeoServer REST 管理接口仅供 Compose 内后端与初始化服务访问；Nginx 阻断 `/geoserver/rest`，但保留受 GeoServer 自身认证保护的 `/geoserver/web` 管理后台。公网部署时应额外限制该后台来源 IP。

## Nginx 与未来 HTTPS

当前 Nginx 使用 `server_name _`，接受通过虚拟机 IP 的 HTTP 请求。未来部署域名时，仅替换 Nginx `server` 块为域名与 TLS 证书配置，并将 `GEOSERVER_PROXY_BASE_URL` 改为 `https://<域名>/geoserver`；其余容器不变。
