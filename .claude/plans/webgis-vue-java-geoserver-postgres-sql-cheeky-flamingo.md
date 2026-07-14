# Skill 拆分方案

## Context

当前 geoserver SKILL.md 176 行，内容涵盖：API 参考、SLD 模板、DOM+XPath 编辑、常见陷阱。按方案二拆分，SKILL.md 保持精炼，长篇内容引用外部文件。

## 结构

```
.claude/skills/geoserver/
├── SKILL.md                  ← 概述 + 核心陷阱 + 文件索引
├── api-reference.md          ← REST API 参考（workspace→style 端点）
└── sld-patterns.md           ← SLD 模板设计 + DOM+XPath 编辑 + 坑
```

## 各文件内容

### SKILL.md（~50 行）
- name/description 不变
- 核心陷阱（Content-Type、UTF-8、Tile 缓存、响应格式）
- 指向 `api-reference.md` 和 `sld-patterns.md` 的索引

### api-reference.md（~70 行）
- 当前 SKILL.md 中 `## 完整 API 参考` 章节
- Workspace / DataStore / FeatureType / Layer / Style 端点
- Style Rename 两步走
- 常见错误表

### sld-patterns.md（~100 行）——重点
- **5 种预设模板设计**（point/line/polygon/raster/generic）
- **DOM+XPath 修补模式**：为什么不用 GeoTools、Parser-Modifier 对称关系
- **XPath vs 手动遍历**：何时可用、何时不可用（相对节点子查询失效）
- **手动遍历模式**：ensureNodePath 逐级创建、deleteNodePath 逐级删除 + 清理空父节点
- **GeoServer 序列化陷阱**：默认值被丢弃（`<WellKnownName>square</WellKnownName>` 消失、Stroke 只剩空壳）
- **ColorMapEntry 属性模式**：setAttribute 而非 setTextContent
- **ColorMap 重建模式**：清空 → 全量重建
- **空值处理策略**：空字符串/ null → 删除节点；空父节点 → 连带删除

## 验证
1. SKILL.md 不超过 60 行
2. api-reference.md 覆盖所有现有 API 参考内容
3. sld-patterns.md 包含 XPath/手动遍历/序列化陷阱等用户指定的要点
