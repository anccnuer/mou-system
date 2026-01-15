## 修复创建菜品接口的跨店食材问题

### 问题分析

创建菜品接口（POST /dishes）没有验证食材是否属于同一个店铺，导致可以创建跨店关联。

### 修复内容

**文件**: `src/routes/dishes.ts`

**修改位置**: POST /dishes 接口（第68-108行）

**具体修改**:

1. 在插入食材关联之前，添加验证逻辑
2. 检查每个 `ingredient_id` 对应的食材是否存在
3. 检查每个食材是否属于同一个店铺（`store_id`）
4. 如果发现跨店食材，返回详细的错误信息，包含：

   * 哪些食材不属于当前店铺

   * 食材名称和所属店铺名称

**验证逻辑**:

```sql
SELECT i.id, i.name, i.store_id, s.name as store_name
FROM ingredients i
JOIN stores s ON i.store_id = s.id
WHERE i.id = ?
```

**错误返回格式**:

```json
{
  "error": "以下食材不属于当前店铺",
  "invalid_ingredients": [
    {
      "ingredient_id": 38,
      "ingredient_name": "三文鱼",
      "store_id": 6,
      "store_name": "西青店"
    }
  ]
}
```

### 预期效果

* 防止创建跨店菜品-食材关联

* 提供清晰的错误提示，帮助用户识别问题

* 保持现有功能不变，只添加验证逻辑

