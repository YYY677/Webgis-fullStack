---
name: cesium-geojson-entity-mapping
description: Cesium GeoJsonDataSource 加载 MultiPolygon 后的 Entity 映射、选中高亮和贴地边界处理
metadata:
  type: reference
---

# Cesium GeoJSON 多面要素映射

适用于将业务表 WKT/GeoJSON 通过 `GeoJsonDataSource.load()` 加入 Cesium，且需要“表格行 ↔ 地图要素”双向选中时。

## 根因：一个 GeoJSON Feature 不保证只生成一个 Entity

Cesium 的 `GeoJsonDataSource` 会将 `MultiPolygon`、`MultiLineString` 等多部件几何拆成多个 Entity。

若 GeoJSON Feature 的 `id` 为 `42`，首个 Entity 使用 `42`，后续 Entity 为避免 ID 冲突会自动改为 `42_2`、`42_3` 等。因此不能再以 `entity.id === 表主键` 作为唯一映射。

这会造成两个可见问题：

- 点击表格行时，仅第一个面变色；
- 点击被拆分出的第二、第三个面时，无法反查到表格行。

## 正确做法：使用业务键属性分组

构建 GeoJSON Feature 时，把稳定的表主键写入 properties：

```ts
feature.id = String(row[table.rowKeyColumn])
feature.properties = {
  rowKey: String(row[table.rowKeyColumn]),
}
```

加载后应从 `entity.properties.rowKey` 读取业务键，并对同一键的全部 Entity 同时高亮：

```ts
function getEntityRowKey(entity: Entity) {
  const property = (entity.properties as any)?.rowKey
  const value = property?.getValue(viewer.clock.currentTime)
  return value == null ? String(entity.id) : String(value)
}

const sameFeatureEntities = source.entities.values.filter(
  (entity) => getEntityRowKey(entity) === rowKey,
)
sameFeatureEntities.forEach((entity) => applyFeatureStyle(entity, true))
```

反查表格行也必须比较 `rowKey`，不能直接比较 `entity.id`。

## 面边界：不要只依赖 Polygon outline

`PolygonGraphics.outline` 在贴地面、卫星底图或复杂边界下可能不够醒目。需要明确展示行政区界时，从 Polygon 的 hierarchy 创建一条独立的贴地 `PolylineGraphics`：

```ts
const hierarchy = entity.polygon?.hierarchy?.getValue(viewer.clock.currentTime)
const positions = hierarchy?.positions

entity.polyline = new PolylineGraphics({
  positions: new ConstantProperty([...positions, positions[0]]),
  clampToGround: new ConstantProperty(true),
})
```

再为该折线设置比填充色更亮的常态颜色；选中时与面填充一起换为强调色。折线放在同一 Entity 中，地图点击仍能返回原业务要素。

## 后置修改 Graphics 的类型约束

`GeoJsonDataSource.load()` 完成后修改已有 `PolylineGraphics` / `PolygonGraphics` 属性时，不能直接赋 `Color`、`number`、`boolean`。这些字段类型分别是 `MaterialProperty` 或 `Property`，需要显式包装：

```ts
entity.polyline!.material = new ColorMaterialProperty(color)
entity.polyline!.width = new ConstantProperty(3)
entity.polyline!.clampToGround = new ConstantProperty(true)

entity.polygon!.material = new ColorMaterialProperty(color.withAlpha(0.15))
entity.polygon!.outline = new ConstantProperty(true)
entity.polygon!.outlineColor = new ConstantProperty(color)
```

直接赋值会导致 TypeScript 报 `Color` 不是 `MaterialProperty`、`number/boolean` 不是 `Property`。
