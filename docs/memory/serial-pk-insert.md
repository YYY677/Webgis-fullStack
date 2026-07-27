---
name: serial-pk-insert
description: PostgreSQL SERIAL 自增主键不应出现在 INSERT 列列表中
metadata:
  type: reference
---

对 SERIAL/BIGSERIAL 主键（如 `gid`）做 INSERT 时，不能把该列放进字段列表，否则 MyBatis 会插入 null 导致违反 NOT NULL 约束。

```sql
-- 错误：gid 是 SERIAL NOT NULL
INSERT INTO "capital" ("gid", "name") VALUES (null, 'test')
-- → null value in column "gid" violates not-null constraint

-- 正确：让数据库自动生成
INSERT INTO "capital" ("name") VALUES ('test')
```

**前端处理**：`saveFields` 必须排除 `gid`。UPDATE 时 gid 通过 `rowKeyColumn`/`rowKeyValue` 传，不进 SET 子句。

**Why:** SERIAL 自增由数据库维护，应用层不该干预。

**How to apply:** 任何动态 INSERT SQL，检查 fields 列表是否包含了自增主键。参考 [[sql-alias-quoting]] — 如果 `getFields` 正确识别了主键列，可在 Service 层自动过滤。