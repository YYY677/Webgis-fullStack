---
name: sql-alias-quoting
description: PostgreSQL 中无引号的列别名被强制转小写，导致 Java Map get 拿不到值
metadata:
  type: reference
---

PostgreSQL 在不加双引号时，所有列别名都转为全小写：
```sql
SELECT udt_name AS type, (c.udt_name = 'geometry') AS isGeom
-- 返回的 key: `type`, `isgeom`（全小写）
```

Java 端 `map.get("isGeom")` 拿到 null，因为实际 key 是 `isgeom`。

**修复**：给需要保留大小写的别名加双引号：
```sql
SELECT (c.udt_name = 'geometry') AS "isGeom"
```

**影响范围**：MyBatis `resultType="java.util.Map"` 查询中所有驼峰别名。

**相关案例**：SpatialMapper.xml 中 `getFields`、`getCatalogTables` 都踩过这个坑。

**Why:** MyBatis 返回 Map 时 column key 直接来自 JDBC ResultSetMetaData，PG 驱动的行为就是小写无引号别名。

**How to apply:** 任何 `SELECT ... AS camelCase FROM` 的 SQL，如果 Java 端通过 Map key 读取，必须给别名加双引号 `AS "camelCase"`。