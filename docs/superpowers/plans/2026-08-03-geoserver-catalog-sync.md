# GeoServer `webgistest` 目录配置同步实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 提供可导出并可幂等应用 `webgistest` GeoServer 目录配置的 PowerShell 工具包。

**架构：** 共享 PowerShell 模块负责安全模板化、REST 调用和资源清洗；导出脚本将源实例转换为仓库内的清单和资源文件；应用脚本按工作空间依赖顺序调用 REST API。Pester 测试验证不含密码的模板、资源清洗和变量替换。

**技术栈：** Windows PowerShell 5.1、Pester 3.4、GeoServer REST API、SLD 1.0。

---

### 任务 1：建立可测试的配置转换模块

**文件：**
- 创建：`infra/geoserver/tests/GeoServerConfig.Tests.ps1`
- 创建：`infra/geoserver/lib/GeoServerConfig.psm1`

- [ ] **步骤 1：编写失败的测试**

测试数据源导出必须删除 `href` 和时间戳，并将连接参数变为 `${GEOSERVER_DATASTORE_*}`；测试 feature type 与 layer 清单必须删除服务器链接和由服务端派生的字段；测试未解析占位符必须抛错。

- [ ] **步骤 2：运行测试验证失败**

运行：`Invoke-Pester .\infra\geoserver\tests\GeoServerConfig.Tests.ps1`

预期：失败，原因是 `GeoServerConfig.psm1` 或待测转换函数尚不存在。

- [ ] **步骤 3：编写最少实现代码**

实现模板替换、数据源/要素类型/图层清洗和 REST 授权辅助函数。模块不得写入源 GeoServer。

- [ ] **步骤 4：运行测试验证通过**

运行：`Invoke-Pester .\infra\geoserver\tests\GeoServerConfig.Tests.ps1`

预期：全部测试通过。

### 任务 2：实现导出与应用脚本

**文件：**
- 创建：`infra/geoserver/export.ps1`
- 创建：`infra/geoserver/apply.ps1`
- 创建：`infra/geoserver/README.md`

- [ ] **步骤 1：编写失败的静态调用测试**

在 Pester 测试中断言两个脚本存在、可解析，并且应用顺序由 manifest 明确控制。

- [ ] **步骤 2：运行测试验证失败**

运行：`Invoke-Pester .\infra\geoserver\tests\GeoServerConfig.Tests.ps1`

预期：失败，原因是导出和应用脚本尚不存在。

- [ ] **步骤 3：编写最少实现代码**

导出脚本读取 workspace、namespace、每个 datastore、feature type、layer 和样式，并生成 manifest；应用脚本按 workspace、namespace、datastore、feature type、style、layer、reload 顺序 POST/PUT 资源。

- [ ] **步骤 4：运行测试验证通过**

运行：`Invoke-Pester .\infra\geoserver\tests\GeoServerConfig.Tests.ps1`

预期：全部测试通过，脚本语法检查无错误。

### 任务 3：导出本机 `webgistest` 配置并检查产物

**文件：**
- 创建：`infra/geoserver/config/**`

- [ ] **步骤 1：运行导出脚本**

运行：`& .\infra\geoserver\export.ps1 -GeoServerUrl http://localhost:8081/geoserver -Workspace webgistest -Credential (Get-Credential)`

预期：生成无密码的 manifest、JSON 和 SLD 文件。

- [ ] **步骤 2：检查敏感信息和配置完整性**

运行：`rg -n "crypt1:|passwd.*[A-Za-z0-9]" infra/geoserver/config`

预期：没有源实例密码；所有数据源密码为占位符。

- [ ] **步骤 3：运行最终验证**

运行：`Invoke-Pester .\infra\geoserver\tests\GeoServerConfig.Tests.ps1`

预期：全部测试通过；manifest 中的数据源、要素类型、图层和样式路径均存在。
