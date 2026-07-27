---
name: flyway-migration-checksum
description: 已执行的 Flyway 迁移文件不能修改内容，否则 checksum 校验失败
metadata:
  type: reference
---

Flyway 执行完迁移后会计算文件 checksum 存入 `flyway_schema_history` 表。后续启动时重新计算对比，不匹配则拒绝启动：

```
Migration checksum mismatch for migration version 2
Applied to database : -598973956
Resolved locally    : 1605410560
```

**修复**：
```sql
DELETE FROM business_data.flyway_schema_history WHERE version IN ('2', '3');
```
然后重启，Flyway 重新执行被删除版本的迁移。

**正确做法**：修改数据应新建 V3，不编辑已执行的 V1/V2。

**Why:** Flyway 通过 checksum 保证迁移的幂等性和可追溯性。改已执行文件等于篡改历史。

**How to apply:** 永远追加新版本，不修改旧版本。如需纠正数据，写 V3 用 UPDATE/DELETE/INSERT。