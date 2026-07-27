---
name: pgrouting-pitfalls
description: pgRouting pgr_dijkstra 常见坑 — 列名映射、cost 歧义、路径拼接
metadata:
  type: reference
---

# pgRouting 路径分析常见坑

## 1. 不要假设列名

`pgr_dijkstra` 要求 `id, source, target, cost` 四列。但实际数据库表的列名可能不同。先查表结构：

```sql
SELECT column_name, udt_name FROM information_schema.COLUMNS
WHERE table_name = 'shenzhen_roads' ORDER BY ordinal_position;
```

本项目：`shenzhen_roads` 已有 `gid, source, target, cost` 四列直接用，不需要 `length AS cost` 别名。

## 2. cost 列歧义

`pgr_dijkstra` 返回的列和 JOIN 的路网表可能有同名列。必须给 pgr 结果加别名：

```sql
-- 错误：cost 歧义
SELECT cost, geom FROM pgr_dijkstra(...) JOIN shenzhen_roads ON edge = gid

-- 正确：别名区分
SELECT pgr.cost, r.geom FROM pgr_dijkstra(...) AS pgr JOIN shenzhen_roads r ON pgr.edge = r.gid
```

## 3. 路径 WKT 拼接用 PostGIS，不要手动拼

Java 代码逐段拆 WKT 拼 LINESTRING 极易出错（端点重复、坐标顺序、Z/M 坐标）。

```sql
-- PostGIS 一步完成：收集 → 合并 → 输出 WKT
SELECT st_astext(st_linemerge(st_collect(r.geom ORDER BY seq))) AS wkt,
       sum(pgr.cost) AS total_cost
FROM pgr_dijkstra('SELECT gid AS id, source, target, cost FROM shenzhen_roads', ?, ?, false) AS pgr
JOIN shenzhen_roads r ON pgr.edge = r.gid
```

## 4. 找最近节点

用 `<->` 算子，不是 `ST_Distance`：

```sql
SELECT id FROM shenzhen_roads_vertices_pgr
ORDER BY geom <-> st_setsrid(st_makepoint(?, ?), 4326) LIMIT 1
```

**Why:** pgRouting 依赖表结构的固定列名约定，假设了列名就会报错。`pgr_dijkstra` 是 SRF（set returning function），不加别名时返回列和 JOIN 表列冲突。Java 手拼坐标是反模式——PostGIS 的 `ST_Collect` + `ST_LineMerge` 就是为此设计的。

**How to apply:** 任何 pgRouting 查询，先 `\d tablename` 确认列名，再写参数化查询。
