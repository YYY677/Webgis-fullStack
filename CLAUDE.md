@AGENTS.md

## Claude-specific notes

- 项目通用规范、技术栈、目录约定和安全边界以根目录 `AGENTS.md` 为唯一来源。
- 当前目录的子项目规则优先于根目录规则：优先读取目标目录下的 `AGENTS.md` 或 `CLAUDE.md`。
- Claude 项目 skill 位于 `.claude/skills/`；Codex 项目 skill 位于 `.agents/skills/`，两套 skill 暂时独立维护。
- 不要在本文件重复维护项目架构、命令、版本或编码规范；新增通用规则请修改 `AGENTS.md`。
