# GeoServer `webgistest` 目录配置同步设计

## 目标

将当前 GeoServer 中 `webgistest` 工作空间的目录配置导出到仓库，并可在同版本、可访问相同数据源的另一台 GeoServer 上重复应用。

## 范围

配置包覆盖工作空间、命名空间、数据源、已发布的要素类型、图层及其默认/备用样式，以及 SLD 样式正文。脚本不修改源 GeoServer；应用脚本仅修改调用者明确指定的目标 GeoServer。

配置包不包含安全目录、全局服务设置、GeoWebCache 缓存、日志、字体、外部样式图片或文件型数据。这些内容属于完整 Data Directory 克隆，不是本次的工作空间目录同步。

## 结构

```text
infra/geoserver/
├── export.ps1
├── apply.ps1
├── lib/GeoServerConfig.psm1
├── config/
│   ├── manifest.json
│   ├── workspace.json
│   ├── namespace.json
│   ├── datastores/
│   ├── featuretypes/
│   ├── layers/
│   └── styles/
├── tests/GeoServerConfig.Tests.ps1
└── README.md
```

`export.ps1` 从 REST API 读取源配置并生成 `config/`。`apply.ps1` 读取 `manifest.json`，按依赖顺序创建或更新目标资源。共享模块负责 JSON 清洗、模板变量替换、鉴权和 REST 调用。

## 安全与可移植性

导出数据源时，`host`、`port`、`database`、`user` 和 `passwd` 分别替换为 `${GEOSERVER_DATASTORE_*}` 占位符；不会把源实例的加密密码写入仓库。应用脚本从参数或同名环境变量读取实际值，并在请求前拒绝未解析的占位符。

SLD 以原始 UTF-8 文本保存。上传样式时使用 `application/vnd.ogc.sld+xml; charset=UTF-8`，避免中文乱码和错误的 StyleHandler 路由。

## 应用顺序

```text
workspace → namespace → datastores → feature types → styles → layers → reload
```

资源已存在时使用 `PUT` 更新；不存在时使用 `POST` 创建。图层由 feature type 发布时产生，随后用导出的图层清单设置状态和样式引用。

## 验收标准

在空的同版本 GeoServer 上运行 `apply.ps1` 后，REST API 能返回 `webgistest`、其数据源、全部导出的要素类型、图层和样式；再次运行 `apply.ps1` 不应因已存在资源失败。
