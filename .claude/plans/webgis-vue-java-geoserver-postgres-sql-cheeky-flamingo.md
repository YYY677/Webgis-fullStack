# 编辑弹窗 UI 布局调整

## Context

当前编辑弹窗 850px 偏宽；描述字段单行不够用；generic 有 4 个 Rule 时选择器横排太长撑宽；表单内容区没有滚动，内容多时弹窗很高。

## 改动（仅 StyleManager.vue）

**弹窗宽度**：`width="850px"` → `width="680px"`

**描述字段**：
- `el-input` → `el-input type="textarea" :rows="2"`
- `style="width: 360px"` → `style="width: 100%"`
- `.meta-fields` 去掉固定 `height: 50px`（textarea 比 input 高）

**Rule 选择器**：
- `el-radio-group` 加 `style="flex-wrap: wrap"`，4 项自动折行成两排

**表单区域**：
- `.style-form` 加 `max-height: 360px; overflow-y: auto`

**图例预览**：
- `.edit-legend` 宽度 200px → 160px

## 验证

1. generic 样式 → Rule 两排显示，不撑宽
2. 描述框 2 行高，可拖动拉高
3. 弹窗 680px，内容完整
4. 表单超出 360px 出现滚动条
