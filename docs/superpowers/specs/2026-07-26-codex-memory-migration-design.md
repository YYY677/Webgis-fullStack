# Codex Memory 迁移设计

## 目标

将现有 Claude 项目 memory 以显式、可版本控制的项目文件形式提供给 Codex 使用。

## 源与目标位置

- 源目录（只读）：`C:\Users\YU\.claude\projects\c--Users-YU-Desktop-Webgis-fullStack\memory`
- 目标目录：`docs/memory/`

原样复制所有 Markdown 文件，不修改文件名或内容。保留 `MEMORY.md` 作为索引，确保其中到各经验记录的相对链接仍然有效。

## Codex 上下文接入

在根 `AGENTS.md` 中增加简短规则：涉及已覆盖的技术领域或排障时，先读取 `docs/memory/MEMORY.md`；仅将已验证、可复用的项目经验补充到该目录。

## 边界

- 不修改或删除 Claude 源 memory。
- 不修改无关的工作区文件。
- 不自动提交或推送。

## 验证

确认 13 个 Markdown 文件均存在于 `docs/memory/`，索引链接均指向该目录中的文件，且根 `AGENTS.md` 已包含读取规则。
