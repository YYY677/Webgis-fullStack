# Claude Code 核心使用教程

> 基于 Claude Code 2026 年中期的实际运行环境整理。
> 当前环境：Windows 11 + DeepSeek 代理模型 + WebGIS 全栈项目。

---

## 目录

1. [概述](#1-概述)
2. [安装与配置](#2-安装与配置)
3. [CLAUDE.md 配置系统](#3-claudemd-配置系统)
4. [核心交互和上下文管理](#4-核心交互和上下文管理)
5. [Slash 命令大全](#5-slash-命令大全)
6. [工具系统](#6-工具系统)
7. [Agent 系统](#7-agent-系统)
8. [Skill 系统](#8-skill-系统)
9. [权限与安全](#9-权限与安全)
10. [MCP 服务器](#10-mcp-服务器)
11. [内存系统](#11-内存系统)
12. [高级功能](#12-高级功能)
13. [常见陷阱](#13-常见陷阱)
14. [最佳实践](#14-最佳实践)

---

## 1. 概述

### 是什么

Claude Code 是 Anthropic 推出的 **终端优先、agent 驱动的 AI 编码工具**。与自动补全类助手不同，它是自主 agent——能读取整个仓库、编辑多文件、执行命令、运行测试、管理 Git，在任务完成前持续迭代。

### 运行环境

| 界面 | 定位 | 说明 |
|---|---|---|
| **终端 CLI** | 首要，功能最完整 | 命令行原生体验 |
| **VS Code 扩展** | IDE 集成 | 可视化 diff、内嵌聊天面板 |
| **JetBrains 插件** | IDE 集成 | 原生 IntelliJ/WebStorm 插件 |
| **claude.ai/code** | Web 界面 | 零安装 |
| **iOS App** | 移动端 | 启动任务，在电脑上继续 |
| **Slack @Claude** | 团队协作 | 在 Slack 频道中工作 |

### 支持模型

| 模型 | 上下文 | 定位 |
|---|---|---|
| Claude Fable 5 | — | 最新前沿模型 |
| Opus 4.8 | 1M tokens | 复杂推理、大范围重构 |
| Sonnet 4.6 | 200K+ | 默认模型，日常开发主力 |
| Haiku 4.5 | — | 快速轻量任务 |

---

## 2. 安装与配置

### 安装

```bash
# macOS/Linux — 原生安装器（推荐，无需 Node.js）
curl -fsSL https://claude.ai/install.sh | bash

# Windows PowerShell
irm https://claude.ai/install.ps1 | iex

# npm 全局安装（适合 CI/CD 版本锁定）
npm install -g @anthropic-ai/claude-code

# npx 免安装
npx @anthropic-ai/claude-code
```

前置依赖：Node.js 18+、Git 2.30+、npm 9+。

### 启动

```bash
# 在当前目录启动交互式会话
claude

# 单次执行模式（不占订阅额度）
claude -p "解释这个项目的架构"

# 指定配置
claude --model opus --effort xhigh
```

### `.claude/` 目录结构

项目根目录下的 `.claude/` 是核心配置目录：

```
.claude/
├── CLAUDE.md               # 项目级指令（可替代根目录 CLAUDE.md）
├── settings.json           # 项目级设置，版本控制
├── settings.local.json     # 本地覆盖，git-ignored
├── skills/                 # 自定义技能包
│   └── <name>/
│       └── SKILL.md
├── agents/                 # 自定义 agent 定义
│   └── <name>.md
├── hooks/                  # 生命周期钩子
├── worktrees/              # 隔离工作目录（自动管理）
├── memory/                 # 持久化内存
└── scheduled_tasks.json    # 定时任务
```

### settings.json

```json
{
  "model": "sonnet",
  "theme": "dark",
  "permissionMode": "default",
  "permissions": {
    "allow": ["Read", "Glob", "Grep", "Bash(npm test)"],
    "deny": ["Bash(rm -rf *)", "Bash(git push --force)"]
  },
  "hooks": {
    "preToolUse": { "Bash": "node scripts/pre-bash.js" }
  },
  "mcpServers": {},
  "env": {},
  "fallbackModels": ["sonnet", "haiku"]
}
```

---

## 3. CLAUDE.md 配置系统

四级分层指令，从全局到本地覆盖：

| 层级 | 路径 | 作用域 | 是否版本控制 |
|---|---|---|---|
| 用户全局 | `~/.claude/CLAUDE.md` | 所有项目 | ❌ |
| 项目根目录 | `<project>/CLAUDE.md` | 本项目 | ✅ |
| 项目隐藏 | `<project>/.claude/CLAUDE.md` | 本项目 | ✅ |
| 本地覆盖 | `<project>/CLAUDE.local.md` | 本项目 | ❌（git-ignored） |

新建项目先用 `/init` 自动生成 CLAUDE.md，至少要包含：

- 技术栈和版本
- 目录结构速览
- 常用命令
- 编码约定

---

## 4. 核心交互和上下文管理

### 工作模式

Claude Code 是 **agentic loop**：收集上下文 → 执行操作 → 验证结果 → 迭代优化。不是一问一答的聊天机器人，而是自主工作的编程搭档。

### 上下文管理命令

| 命令 | 作用 |
|---|---|
| `/compact` | 压缩当前对话，释放上下文空间。接近限额时自动触发，也可手动跑 |
| `/clear` | 清除对话历史回到初始状态。可用 `/rewind` 恢复 |
| `/context` | 查看当前上下文使用情况（总限额、已用、分类占比） |
| `/usage` | 查看 skills、subagents、MCP 等各组件消耗分解 |

**建议**：长对话定期 `/compact`，复杂任务拆成 `/goal` 步骤。

---

## 5. Slash 命令大全

截至 2026 年中期，内置 36+ 个命令。

### 会话管理

| 命令 | 用途 |
|---|---|
| `/clear` | 清除对话历史 |
| `/compact` | 压缩当前对话 |
| `/resume <id>` | 恢复已存档会话 |
| `/rename <name>` | 重命名会话 |
| `/rewind` | 回退到检查点（支持跨 `/clear`） |
| `/exit` | 退出 |
| `/cd <path>` | 切换工作目录 |

### 项目配置

| 命令 | 用途 |
|---|---|
| `/init` | 生成初始 CLAUDE.md |
| `/config key=value` | 运行时设置 |
| `/memory` | 编辑持久化内存 |
| `/permissions` | 编辑权限规则 |
| `/mcp` | 管理 MCP 服务器 |
| `/hooks` | 管理生命周期钩子 |

### 状态监控

| 命令 | 用途 |
|---|---|
| `/status` | 当前会话状态 |
| `/context` | 上下文使用量 |
| `/cost` | token 消耗估算 |
| `/usage` | plan 限额分解 |
| `/stats` | 历史使用统计 |
| `/doctor` | 健康检查/诊断 |

### 工作模式

| 命令 | 用途 |
|---|---|
| `/model` | 切换模型 |
| `/effort <level>` | 设置努力级别（low/medium/high/xhigh/ultra） |
| `/fast` | 快速模式 |
| `/plan` | 只读规划模式，不变更文件 |
| `/vim` | Vim 键位 |
| `/theme` | 切换主题 |

### 高级功能

| 命令 | 用途 |
|---|---|
| `/agents` | 查看所有 agent 会话 |
| `/tasks` | 管理任务列表 |
| `/goal <condition>` | 条件驱动——持续工作直到条件满足 |
| `/loop <interval> <cmd>` | 间隔驱动——按时间间隔重复 |
| `/batch <instruction>` | 并行派发 5-30 个 agent，各开 PR |
| `/background <prompt>` | 后台分离运行，释放终端 |
| `/review` | 审查 GitHub PR |
| `/code-review [level]` | 审查当前 diff |
| `/simplify` | 代码简化清理 |
| `/commit` | 生成 commit message 并提交 |
| `/diff` | 显示文件差异 |
| `/plugin` | 浏览插件市场 |

---

## 6. 工具系统

Claude Code 内部工具（用户不可见，但理解它们有助于理解能力边界）。

### 文件操作

| 工具 | 用途 | 关键限制 |
|---|---|---|
| **Read** | 读文件，最多 2000 行 | 大文件消耗大 |
| **Write** | 创建/覆盖文件 | 必须先 Read 再 Write |
| **Edit** | 精确字符串替换修改 | `old_string` 必须唯一匹配 |
| **Glob** | 按路径模式匹配文件 | 只搜文件名 |
| **Grep** | 基于 ripgrep 的内容搜索 | 正则搜索文件内容 |

### 执行与搜索

| 工具 | 用途 | 关键限制 |
|---|---|---|
| **Bash** | 执行 shell 命令 | 无沙箱隔离 |
| **WebSearch** | 搜索引擎查询 | 支持域名过滤 |
| **WebFetch** | 获取单 URL 转 markdown | 单页面摘要 |

### 工具使用规则

- **Edit vs Write**：Edit 增量改，Write 全量覆盖。优先 Edit
- **Read + Glob + Grep 配合**：Glob 找文件 → Read 读内容；Grep 搜内容
- **Read-before-Write**：已存在的文件必须先 Read 后才能 Write，否则拒绝
- **Edit 唯一匹配**：`old_string` 在文件中只能出现一次，否则失败

---

## 7. Agent 系统

### 概念分层

- **主 agent**：当前和你对话的 Claude
- **子 agent（Subagent）**：通过 `Agent` 工具派发，独立上下文窗口，执行完回结论
- **Agent 定义**：`.claude/agents/<name>.md` 中可以自定义 agent 类型

### 自定义 Agent

```yaml
---
name: code-reviewer
description: 代码审查专用 agent
model: sonnet
tools: [Read, Grep, Glob, Bash]
maxTurns: 15
permissionMode: plan
---

# 指令
- 审查安全漏洞、性能瓶颈、风格合规
- 输出按严重性排序
```

### 多 Agent 编排

- 可同时派发最多 **7 个并行子 agent**
- Agent 深度限制 **5 层**
- `/batch` 可协调 5-30 个并行 agent
- **子 agent 无法访问 MCP 工具**

### Workflow（多 agent 脚本）

通过 `Workflow` 工具运行脚本化编排，适合大规模审计、迁移、检查：

```javascript
export const meta = {
  name: 'find-bugs',
  description: '多 agent 并发扫描代码缺陷',
  phases: [{ title: 'Find' }, { title: 'Verify' }],
};

const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { phase: 'Find', schema: SCHEMA }),
  r => parallel(r.findings.map(f => () =>
    agent(`Verify: ${f.title}`, { phase: 'Verify', schema: VERDICT })
  ))
);
```

---

## 8. Skill 系统

### Skill 是什么

Skill 是结构化的操作手册——告诉 AI 如何执行特定领域任务。跨工具通用标准（Claude Code、Cursor、Gemini CLI 等都支持 SKILL.md 格式）。

### 目录结构

```
.claude/skills/<name>/
├── SKILL.md              # 必需
├── scripts/              # 可选
└── references/           # 可选
```

### SKILL.md Frontmatter

```yaml
---
name: my-skill
description: Use when ...（触发条件，决定自动调用时机）
disable-model-invocation: false  # true = 仅手动 /my-skill
user-invocable: true             # false = 隐藏，仅作背景知识
allowed-tools: [Read, Grep, Bash]
context: fork                    # fork = 隔离 subagent 运行
model: sonnet
---
```

**关键**：`description` 只写**触发条件**，不要总结工作流程。否则 Claude 可能跟 description 走而不读完整 SKILL.md。

### 加载位置（按优先级）

1. `.claude/skills/`（项目级，git-tracked）
2. `~/.claude/skills/`（用户全局）
3. 插件安装

### 你的项目：superpowers-zh 框架

已安装 20 个中文 skill，核心约束：

- **设计先行**：收到任务先检查匹配 skill，用 `/brainstorming` 探索需求
- **测试驱动**：用 `/test-driven-development`，测试先于实现
- **验证闭环**：用 `/verification-before-completion`，声称完成前必须验证

---

## 9. 权限与安全

### 六种权限模式

| 模式 | 免确认操作 | 适用场景 |
|---|---|---|
| `default` | 仅读取 | 日常开发 |
| `acceptEdits` | 读+编辑+常见文件命令 | 迭代编码 |
| `plan` | 只读，全部阻止 | 代码审查 |
| `auto` | 几乎全部，后台安全审查 | 长运行任务 |
| `dontAsk` | 仅白名单命令 | CI/CD 锁定 |
| `bypassPermissions` | 全部（危险） | 仅隔离容器 |

快捷键 `Shift+Tab` 或 `Alt+M` 在会话中循环切换。

### 受保护路径（所有模式默认拦截）

- `.git`、`.vscode`、`.idea`、`.husky`、`.mvn`
- `.claude/`（除 worktrees 外）
- `.bashrc`、`.npmrc`、`.gitconfig`、`.mcp.json`

### 红线操作（你的项目约定）

即使在 auto-accept 模式也必须先问你：

- 删除文件、目录或 Git 历史
- 修改 `.env`、密钥、token、证书、CI/CD
- `git push`、`git rebase`、`git reset --hard`、强制推送
- 公开发布

---

## 10. MCP 服务器

### MCP 是什么

Model Context Protocol——AI 模型连接外部工具和服务的标准化协议。相当于"AI 工具的 USB-C 接口"。

### 配置

```bash
# CLI 添加
claude mcp add my-server -- node /path/to/server.js

# HTTP 远程
claude mcp add my-server --transport http https://example.com/mcp

# 带环境变量
claude mcp add my-server -s user -e API_KEY=sk-xxx -- node server.js
```

**`.mcp.json`**（版本控制，团队共享）：

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": { "DATABASE_URL": "postgresql://localhost:5432/mydb" }
    }
  }
}
```

### 注意事项

- 每个 MCP 服务器消耗约 5K-10K tokens 上下文空间
- 首次调用 1-5 秒启动（按需启动），后续快速
- 子 agent **不能访问** MCP 工具
- `/usage` 查看各 MCP 消耗分解

---

## 11. 内存系统

### 内置自动内存

位置：`~/.claude/projects/<编码的项目路径>/memory/`

- 每次会话启动前 **200 行**自动注入到系统提示
- 超出部分静默丢弃
- 用 Write/Edit 管理，直接说"记住 X"即可写入

### 三层内存体系

| 层 | 位置 | 用途 |
|---|---|---|
| CLAUDE.md | `~/.claude/` / `<project>/` | 稳定的持久指令 |
| 自动内存 | `~/.claude/projects/.../memory/` | 跨会话关键信息 |
| `/remember` | 对话中触发 | 记住当前决定 |

### MEMORY.md 最佳实践

- 保持 200 行以内，作为索引
- 每行一条链接 + 关键事实
- 详情拆到主题文件，从索引链接

---

## 12. 高级功能

### Worktree 隔离

后台子 agent 默认在 `.claude/worktrees/` 下隔离运行，互不影响。
可通过 `worktree.bgIsolation: "none"` 关闭。

### Cron 定时任务

用 `CronCreate` 工具：

```javascript
// 定时提醒/检查
CronCreate({
  cron: "30 9 * * 1-5",    // 工作日 9:30
  prompt: "检查 CI 构建状态",
  durable: true              // 持久化，重启不丢
})
```

- 定时任务 7 天后自动过期
- 支持 one-shot（`recurring: false`）和 recurring

### /goal 条件驱动

```
/goal 直到所有测试通过
Claude 持续运行 → 失败 → 修复 → 重跑 → 直到全部通过
```

### /loop 间隔驱动

```
/loop 5m 运行测试并报告结果
每 5 分钟执行一次，7 天后自动停
```

### /batch 批量并行

```
/batch 将 src/ 中的所有 API 调用从 axios 迁移到 fetch
```

派发 5-30 个并行 agent，各在独立 worktree，各开 PR。

### /background 后台运行

```
/background 分析这个仓库的性能瓶颈
```

后台独立会话执行，空闲 1 小时后暂停，`claude respawn --all` 恢复。

### Token 预算控制

```
claude --budget 100000
限制本次会话最大 token 消耗
```

Workflow 脚本内通过 `budget` 全局变量控制：

```javascript
while (budget.total && budget.remaining() > 50000) {
  // 动态扩展扫描深度
}
```

---

## 13. 常见陷阱

### 文件操作

- **Write 必须先 Read**：文件已存在时没 Read 过就 Write，会被拒绝
- **Edit 的 old_string 必须唯一**：不唯一就失败。此时用更长的上下文做匹配，或改用 Write 全量覆盖
- **Glob/Grep 可能丢失**：部分版本中这两个工具不定时消失。备选：`Bash(grep ...)` 或 `Bash(find ...)`

### 搜索

- **WebFetch 只返回单页摘要**：不能跟踪链接。需要多页面研究先用 WebSearch 获得多个来源
- **WebSearch 无缓存**：每次拉取最新结果

### Agent 限制

- **子 agent 不能访问 MCP 工具**：如果子任务需要外部服务需额外设计
- **子 agent 不能发子 agent**：Agent 工具深度有限
- **MCP 消耗上下文**：每个 MCP 服务器 5K-10K tokens，不宜挂太多

### GeoServer 特定（你的项目）

Content-Type 极敏感，错了报 `No such style handler`：

- CRUD 用 `application/json`
- SLD 创建更新用 `application/vnd.ogc.sld+xml`
- UTF-8 中文用 `byte[]` 发，MediaType 加 `;charset=UTF-8`

---

## 14. 最佳实践

### 项目管理

1. 每个项目先用 `/init` 生成 CLAUDE.md
2. 把技术栈、目录结构、编码规范、常用命令写进去
3. 团队约定（命名规范、架构决策）写入 CLAUDE.md

### Skill 使用

1. 收到任务先检查有没有匹配 skill
2. 创建自定义 skill 封装领域知识
3. description 只写触发条件，不总结工作流
4. SKILL.md 控制在 500 行 / 5K tokens 以内

### 代码质量流程

1. `/plan` 模式分析 → 确认方案
2. 实现
3. `/code-review` 审查 bug
4. 必要时 `/simplify` 清理
5. `/verify` 端到端验证
6. `/commit` 提交

### 权限策略

- 日常开发用 `acceptEdits` 减少确认疲劳
- 敏感命令提前配 deny 规则
- 运行测试等安全操作预授权到 `permissions.allow`

### 上下文管理

- 长会话定期 `/compact`
- 复杂任务拆成多个 `/goal` 步骤
- `/usage` 查看各组件消耗，关闭不需要的 skills/MCP

### Workflow 适用场景

需要时才用，不要默认跑 workflow：

- **大规模审计**：多维度并行扫描代码缺陷
- **批量迁移**：跨文件重构/迁移
- **全面审查**：多角度交叉验证
- **研究探索**：多搜索方式并行查询
- **单次 token 消耗可能是普通对话的 15 倍**
