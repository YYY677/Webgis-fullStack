# Codex Memory 迁移实现计划

> **面向 AI 代理的工作者：** 执行本计划时使用 `subagent-driven-development`（推荐）或 `executing-plans`；以复选框跟踪进度。

**目标：** 将 Claude 项目 memory 原样迁移到 `docs/memory/`，并通过根 `AGENTS.md` 将其作为 Codex 的按需项目上下文。

**架构：** `docs/memory/MEMORY.md` 保持为入口索引，其余经验文档保持原始文件名与相对链接。根 `AGENTS.md` 只增加一段按需读取和维护规则，不改动既有规则。

**技术栈：** Markdown、PowerShell、Git。

---

### 任务 1：迁移记忆文件并接入 Codex 上下文

**文件：**

- 创建：`docs/memory/MEMORY.md`
- 创建：`docs/memory/cesium-3dtiles-pitfalls.md`
- 创建：`docs/memory/cesium-imagery-layer-pattern.md`
- 创建：`docs/memory/cesium-terrain-provider-evolution.md`
- 创建：`docs/memory/flyway-migration-checksum.md`
- 创建：`docs/memory/geoserver-content-type.md`
- 创建：`docs/memory/geoserver-utf8-body.md`
- 创建：`docs/memory/ol-ref-pattern.md`
- 创建：`docs/memory/pgrouting-pitfalls.md`
- 创建：`docs/memory/serial-pk-insert.md`
- 创建：`docs/memory/spatial-layer-cleanup.md`
- 创建：`docs/memory/sql-alias-quoting.md`
- 创建：`docs/memory/srid-4326-convention.md`
- 修改：`AGENTS.md`（新增“项目经验记忆”小节）

- [x] **步骤 1：确认源文件清单与目标目录不存在同名文件。**

  运行：

  ```powershell
  $source = 'C:\Users\YU\.claude\projects\c--Users-YU-Desktop-Webgis-fullStack\memory'
  (Get-ChildItem -LiteralPath $source -File -Filter '*.md').Count
  Test-Path -LiteralPath 'docs\memory'
  ```

  预期：输出 `13`，且目标目录不存在或为空。

- [x] **步骤 2：复制全部 Markdown memory 文件，保留文件名和 UTF-8 内容。**

  运行：

  ```powershell
  $source = 'C:\Users\YU\.claude\projects\c--Users-YU-Desktop-Webgis-fullStack\memory'
  New-Item -ItemType Directory -Path 'docs\memory' -Force | Out-Null
  Get-ChildItem -LiteralPath $source -File -Filter '*.md' | Copy-Item -Destination 'docs\memory' -Force
  ```

- [x] **步骤 3：在 `AGENTS.md` 的项目工作方式后新增“项目经验记忆”小节。**

  写入以下规则：

  ```markdown
  ## 项目经验记忆

  - 涉及 Cesium、OpenLayers、GeoServer、PostGIS、pgRouting、Flyway 或相关排障时，先阅读 `docs/memory/MEMORY.md`，再按索引打开相关经验记录。
  - 仅将已验证、可复用且与本项目相关的经验补充到 `docs/memory/`；保持 `MEMORY.md` 索引与文件同步。
  ```

- [x] **步骤 4：验证迁移完整性、索引链接和上下文规则。**

  运行：

  ```powershell
  $memoryFiles = Get-ChildItem -LiteralPath 'docs\memory' -File -Filter '*.md'
  if ($memoryFiles.Count -ne 13) { throw "Expected 13 memory files, got $($memoryFiles.Count)." }
  $targets = [regex]::Matches((Get-Content -LiteralPath 'docs\memory\MEMORY.md' -Raw -Encoding utf8), '\]\(([^)]+\.md)\)') | ForEach-Object { $_.Groups[1].Value }
  $missing = $targets | Where-Object { -not (Test-Path -LiteralPath (Join-Path 'docs\memory' $_)) }
  if ($missing) { throw "Missing indexed files: $($missing -join ', ')" }
  if (-not (Select-String -LiteralPath 'AGENTS.md' -Pattern 'docs/memory/MEMORY.md' -Quiet)) { throw 'AGENTS.md does not reference the memory index.' }
  'Memory migration verified.'
  git diff --check
  ```

  预期：输出 `Memory migration verified.`；以源/目标 SHA-256 一致性作为复制正确性的依据。若 `git diff --check` 报告无关旧问题或原始 memory 中已存在的空白问题，单独说明其文件和行号，且不修改该文件。

- [x] **步骤 5：检查变更范围，不提交或推送。**

  运行：

  ```powershell
  git status --short
  git diff -- AGENTS.md docs/memory docs/superpowers/specs/2026-07-26-codex-memory-migration-design.md docs/superpowers/plans/2026-07-26-codex-memory-migration.md
  ```

  预期：仅出现 memory 文档、设计文档、执行计划和根 `AGENTS.md` 的本任务变更；现有前端改动保持原样。
