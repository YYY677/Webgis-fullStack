# GeoServer `webgistest` 配置包与完整备份

这个目录同时放了两类东西，必须分开理解：

- `config/`、`export.ps1`、`apply.ps1`：用于把 `webgistest` 的**目录配置**保存到 Git，并在另一台兼容 GeoServer 中重复应用。
- `GeoServer.zip`：从本机 `C:\ProgramData\GeoServer` 复制得到的**完整 Data Directory 备份**，用于灾备或本机还原参考，不是日常配置同步的输入。

覆盖范围：workspace、namespace、PostGIS datastore、已发布 feature type、layer 设置和 SLD 样式。

不覆盖：安全用户/角色、全局 WMS/WFS 设置、GeoWebCache 缓存、日志、字体、外部图形资源和文件型数据。需要完整服务器克隆时，应在停止 GeoServer 后另行备份完整 Data Directory。

## `GeoServer.zip` 是什么，为什么不能直接当 Git 配置包

`GeoServer.zip` 是 Data Directory 的全量快照。当前压缩包中不仅有工作空间和样式，还包含：

- `security/`，包括用户、角色、主密码和加密密钥材料；
- `gwc/`，GeoWebCache 已生成的瓦片缓存；
- `data/`、`coverages/` 等文件型示例数据；
- 全局配置、日志、临时文件和其他与本机运行状态相关的内容。

因此它适合在**私密且受控的位置**保留，用于“这台 GeoServer 出故障后如何还原”；它不适合当作多人协作时的普通 Git 配置文件，更不能直接推送到公开仓库。尤其是 `security/geoserver.jceks`、`security/masterpw.digest` 和用户配置，会把原实例的安全状态一并带走。

日常协作请以 `config/` 作为唯一可审查来源：它只表达“应有哪些 workspace、datastore、feature type、layer、SLD”，连接密码改由执行时的环境变量提供。

## 先理解这个目录

把这个目录当成“GeoServer 配置安装包”。它只复制 GeoServer 的目录配置，不复制 PostgreSQL 中的空间表和数据。

``` text
运行中的 GeoServer
        │ export.ps1（只读 GET）
        ▼
config/（可提交到 Git 的配置包）
        │ apply.ps1（POST / PUT）
        ▼
另一台或本机的 GeoServer
```

### `.ps1` 和 `.psm1` 是什么

-   `export.ps1`、`apply.ps1`：PowerShell 脚本。你在终端中直接运行的就是它们。
    -   `export.ps1` 是导出器：从 GeoServer 读取配置并写入 `config/`。
    -   `apply.ps1` 是安装器：读取 `config/` 并调用 GeoServer REST API 创建或更新配置。
-   `lib/GeoServerConfig.psm1`：PowerShell 模块，也就是两个脚本共用的工具箱。它负责 JSON 读写、REST 请求、密码占位符替换，以及把 `-TargetWorkspace` 解析成新的 namespace URI。它不需要单独运行。

### `config/` 里的 JSON 和 SLD 是什么

这里的 JSON 是通过 GeoServer REST API 传递的目录配置，不等于 GeoServer Data Directory 内部的全部文件格式。

| 文件或目录 | 作用 |
|------------------------------------|------------------------------------|
| `manifest.json` | 本配置包的总目录，列出需要应用的数据源、图层和样式文件。 |
| `workspace.json` | 工作空间名称。 |
| `namespace.json` | 工作空间的唯一标识 URI。 |
| `datastores/*.json` | PostGIS 的连接配置。 |
| `featuretypes/*.json` | 发布哪张空间表、坐标系、范围等。 |
| `layers/*.json` | 图层开关、可查询性、默认样式等。 |
| `styles/**/*.sld` | 地图渲染规则，例如点、线、面使用什么颜色和符号。 |

SLD 是样式规则的 XML 标准格式，因此样式不用 JSON 保存。当前包有 5 个 SLD：`generic`、`point`、`polygon`、`webgistest` 是全局样式，已被图层引用；`shenzhen_roads` 是 `webgistest` 工作空间中的样式，目前已保存但没有被任何图层引用。

### 命令参数和 `$env:` 变量来自哪里

下面两类东西来源不同：

-   `-GeoServerUrl(目标 GeoServer 地址)`、`-TargetWorkspace(新建或更新哪个工作空间)`、`-SkipGlobalStyles(不重复上传全局样式)`：是本项目 `apply.ps1` 自己定义的参数，不是 GeoServer 或 PowerShell 自动提供的。
-   `-WhatIf(只预演，不发送写请求)`：是 PowerShell 的标准预演参数；`apply.ps1` 明确启用了它，所以 PowerShell 会只显示计划、不发送写请求。
-   `$env:GEOSERVER_DATASTORE_*`：是当前 PowerShell 窗口的环境变量。`apply.ps1` 用它们填充 datastore JSON 中的占位符，告诉新的 GeoServer datastore 应连接哪台 PostgreSQL、哪个数据库、用哪个用户。

``` powershell
$env:GEOSERVER_DATASTORE_HOST = 'localhost'       # PostgreSQL 所在机器
$env:GEOSERVER_DATASTORE_PORT = '5432'            # PostgreSQL 端口
$env:GEOSERVER_DATASTORE_DATABASE = 'webgistest'  # 要连接的数据库
$env:GEOSERVER_DATASTORE_USER = 'postgres'        # 数据库用户名
$env:GEOSERVER_DATASTORE_PASSWORD = '你的密码'     # 数据库密码
```

这些变量只在当前 PowerShell 窗口有效，不会提交到 Git。关闭这个窗口后它们会消失。

## 导出当前实例

在项目根目录运行：

``` powershell
& .\geoserver\export.ps1 `
  -GeoServerUrl 'http://localhost:8081/geoserver' `
  -Workspace 'webgistest' `
  -Force
```

脚本会提示输入 GeoServer 管理员凭据，并重建 `config/`。源 GeoServer 只会收到 `GET` 请求。

导出后，datastore 的 `host`、`port`、`database`、`user`、`passwd` 和 `namespace` 会变成模板变量；源实例密码不会写入文件。

## 应用到另一台 GeoServer

目标 GeoServer 必须与源端兼容，并能连接到对应的数据源。使用环境变量提供 datastore 参数：

``` powershell
$env:GEOSERVER_DATASTORE_HOST = 'localhost'
$env:GEOSERVER_DATASTORE_PORT = '5432'
$env:GEOSERVER_DATASTORE_DATABASE = 'webgistest'
$env:GEOSERVER_DATASTORE_USER = 'postgres'
$env:GEOSERVER_DATASTORE_PASSWORD = '你的 PostgreSQL 密码'

& .\geoserver\apply.ps1 `
  -GeoServerUrl 'http://localhost:8081/geoserver' `
```

先用 `-WhatIf` 预览写操作：

``` powershell
& .\geoserver\apply.ps1 `
  -GeoServerUrl 'http://localhost:8081/geoserver' `
  -WhatIf
```

脚本按 `workspace → namespace → datastore → feature type → style → layer → reload` 顺序执行。资源存在时使用 `PUT` 更新，不存在时使用 `POST` 创建。

> 注意：本次 `webgistest` 图层引用了全局样式 `generic`、`point`、`polygon` 和 `webgistest`。应用到已有 GeoServer 时，同名全局样式会被同步包中的 SLD 覆盖；先在测试实例执行 `-WhatIf`，确认该实例没有其他工作空间依赖这些样式。

## 在本机创建 `webgistest_copy` 验证

这个验证**不需要复制 PostgreSQL 数据库**。新工作空间仍连接现有的 `webgistest` 数据库，因此它与原工作空间会读取同一批空间表。不要通过副本做 WFS-T、新增数据、删数据或改表结构。

在项目根目录打开 PowerShell，依次执行下面两段命令。第 1 段只是预演，只发送 `GET` 请求：

``` powershell
$env:GEOSERVER_DATASTORE_HOST = 'localhost'
$env:GEOSERVER_DATASTORE_PORT = '5432'
$env:GEOSERVER_DATASTORE_DATABASE = 'webgistest'
$env:GEOSERVER_DATASTORE_USER = 'postgres'
$env:GEOSERVER_DATASTORE_PASSWORD = '填写 PostgreSQL 密码'

& .\geoserver\apply.ps1 `
  -GeoServerUrl 'http://localhost:8081/geoserver' `
  -TargetWorkspace 'webgistest_copy' `
  -SkipGlobalStyles `
  -WhatIf
```

输出应包含 `Post workspace 'webgistest_copy'`、2 个 datastore、7 个 feature type、1 个工作空间样式和 7 个 layer。确认后，运行第 2 段；它会真正创建新工作空间和图层目录，但不会写入 PostGIS 表：

``` powershell
& .\geoserver\apply.ps1 `
  -GeoServerUrl 'http://localhost:8081/geoserver' `
  -TargetWorkspace 'webgistest_copy' `
  -SkipGlobalStyles
```

脚本会要求输入 GeoServer 管理员用户名和密码。完成后，在 GeoServer 管理后台确认存在 `webgistest_copy` 工作空间，并在图层预览或 QGIS 中加载 `webgistest_copy:*` 的 7 个图层。WMS 地址为：`http://localhost:8081/geoserver/webgistest_copy/wms`。

## 提交前检查

导出完成后运行：

``` powershell
rg -n 'crypt1:' geoserver/config
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Import-Module Pester; Invoke-Pester '.\geoserver\tests\GeoServerConfig.Tests.ps1'"
```

第一条命令不应发现密码；第二条命令应全部通过。

## 版本约束

当前本机服务为 GeoServer 2.26.1。使用此包的实例应固定到兼容版本，并安装与源端相同的扩展；否则 REST 资源或样式可能不兼容。
