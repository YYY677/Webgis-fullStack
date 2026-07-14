# SLD 编辑设计模式

## 架构：Parser-Modifier 对称

```
Parser  读 SLD XML → List<MapStyle>（给前端表单）
Modifier 拿 List<MapStyle> → 修补 SLD XML（写回）
```

两者共享相同的字段→XPath 映射表，保证读写路径一致。

## 为什么不用 GeoTools 序列化

GeoTools 编解码会破坏原始 SLD：
- 丢弃 VendorOption、ElseFilter 等非标准元素
- 重新排列节点顺序
- 改写命名空间前缀

改用 DOM 解析 + XPath 定位 + `setTextContent` 修改，其余字节原封不动。

## 5 种预设 SLD 模板

| 类型 | 内容 |
|------|------|
| `point` | 单个 PointSymbolizer（square, #FF0000, 6px） |
| `line` | 单个 LineSymbolizer（#0000FF） |
| `polygon` | 单个 PolygonSymbolizer（#AAAAAA 填充 + 黑色描边） |
| `raster` | Opacity + ColorMap（6 级渐变色） |
| `generic` | 混合 4 种类型的完整 SLD，含 Filter + ElseFilter + ruleEvaluation:first |

## XPath 查询 vs 手动遍历

| 场景 | 方式 | 可靠性 |
|------|------|--------|
| 查整个文档找 Rule 节点 | `//sld:Rule[sld:Name='...']` | ✅ 稳定 |
| 相对于 Rule 节点查子元素 | `xp.evaluate(xpath, rule, ...)` | ❌ 不稳定（Java XPath 实现问题） |
| 相对于 Rule 节点查子元素 | 手动遍历子节点匹配命名空间+标签名+属性 | ✅ 始终可靠 |

**结论**：Modifier 里所有相对于 Rule 的子节点查找都用手动遍历（`ensureNodePath` / `deleteNodePath`），不依赖 XPath。

### 手动遍历模式

```
Sld:Stroke/sld:CssParameter[@name='stroke']
→ 拆成 [Stroke, CssParameter]
→ 在 Rule 子节点中找 Stroke（匹配命名空间 SLD_NS + 标签名 Stroke）
→ 在 Stroke 子节点中找 CssParameter（额外匹配 name 属性）
→ 找到就 setTextContent，没找到就 createElement
```

## 空值处理

`null` 或 `""` → **删除节点**（留空标签 GeoServer 渲染失败）

```
用户清空边框色 → Modifier 删除 CssParameter
→ 检查父节点 Stroke 是否还有子 Element
→ 没有则连带删除 Stroke → 无残留空标签
```

## GeoServer 序列化陷阱

GeoServer 收到 SLD 后通过 GeoTools 解析成内部对象再重新序列化，**会丢弃它认为可省略的默认值元素**：

| 丢失的元素 | 表现 |
|-----------|------|
| `<WellKnownName>square</WellKnownName>` | 点符号缺失，GeoServer 内部仍是 square |
| `<CssParameter name="stroke-width">1</CssParameter>` | Stroke 只剩空壳 `<sld:Stroke/>` |
| `<Opacity>1.0</Opacity>` | 栅格缺失 |
| `<ElseFilter/>` | 序列化时不保留 |
| `<VendorOption>` | 非标准元素，直接丢弃 |

不影响渲染（GeoServer 引擎记住了解析后的值），但 **Parser 读回来时空字段显示为 ""**，用户保存一次后 `ensureNodePath` 会重新创建补齐。

## ColorMapEntry 属性模式

ColorMapEntry 的数据在 XML **属性**中，不是文本节点：

```xml
<ColorMapEntry color="#AAFFAA" quantity="1000" label="values"/>
// 必须用 setAttribute("color", "#AAFFAA")，不能 setTextContent
```

ColorMap 子元素数量可变 → 重建策略：清空所有 ColorMapEntry → 按列表全量重建。

## ensureNodePath — 逐级创建

XPath `sld:Fill/sld:CssParameter[@name='fill']` 路径上的中间节点不存在时，逐级创建：

```
Mark 存在 → 找 Fill → 不存在 → 创建 Fill → 找 CssParameter → 创建并设 name=fill → setTextContent
```

与 deleteNodePath 对称，一个建一个删。
