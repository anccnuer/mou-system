-- 简化版数据修复脚本
-- 问题：菜品和食材跨店关联
-- 目标：确保每个店铺都有完整的菜品和食材数据，且菜品-食材关联在同一店铺内

-- ============================================
-- 第一步：查看当前数据状况
-- ============================================

-- 查看所有店铺
SELECT '=== 所有店铺 ===' as info;
SELECT id, name FROM stores;

-- 查看跨店的dish_ingredients关系
SELECT '=== 跨店关联数据 ===' as info;
SELECT 
    di.id as relation_id,
    d.id as dish_id,
    d.name as dish_name,
    d.store_id as dish_store_id,
    s_dish.name as dish_store_name,
    i.id as ingredient_id,
    i.name as ingredient_name,
    i.store_id as ingredient_store_id,
    s_ingredient.name as ingredient_store_name
FROM dish_ingredients di
JOIN dishes d ON di.dish_id = d.id
JOIN ingredients i ON di.ingredient_id = i.id
JOIN stores s_dish ON d.store_id = s_dish.id
JOIN stores s_ingredient ON i.store_id = s_ingredient.id
WHERE d.store_id != i.store_id
ORDER BY d.store_id, d.id;

-- ============================================
-- 第二步：复制食材到缺失的店铺
-- ============================================

-- 将西青店的食材复制到北辰店（如果北辰店没有同名食材）
INSERT INTO ingredients (name, quantity, unit, store_id)
SELECT 
    i.name, 
    i.quantity, 
    i.unit, 
    7 as store_id  -- 北辰店
FROM ingredients i
WHERE i.store_id = 6  -- 西青店
  AND NOT EXISTS (
    SELECT 1 FROM ingredients i2 
    WHERE i2.name = i.name AND i2.store_id = 7
  );

-- 将北辰店的食材复制到西青店（如果西青店没有同名食材）
INSERT INTO ingredients (name, quantity, unit, store_id)
SELECT 
    i.name, 
    i.quantity, 
    i.unit, 
    6 as store_id  -- 西青店
FROM ingredients i
WHERE i.store_id = 7  -- 北辰店
  AND NOT EXISTS (
    SELECT 1 FROM ingredients i2 
    WHERE i2.name = i.name AND i2.store_id = 6
  );

-- ============================================
-- 第三步：复制菜品到缺失的店铺
-- ============================================

-- 将北辰店的菜品复制到西青店（如果西青店没有同名菜品）
INSERT INTO dishes (name, store_id)
SELECT 
    d.name, 
    6 as store_id  -- 西青店
FROM dishes d
WHERE d.store_id = 7  -- 北辰店
  AND NOT EXISTS (
    SELECT 1 FROM dishes d2 
    WHERE d2.name = d.name AND d2.store_id = 6
  );

-- 将西青店的菜品复制到北辰店（如果北辰店没有同名菜品）
INSERT INTO dishes (name, store_id)
SELECT 
    d.name, 
    7 as store_id  -- 北辰店
FROM dishes d
WHERE d.store_id = 6  -- 西青店
  AND NOT EXISTS (
    SELECT 1 FROM dishes d2 
    WHERE d2.name = d.name AND d2.store_id = 7
  );

-- ============================================
-- 第四步：修复跨店的dish_ingredients关联
-- ============================================

-- 删除所有跨店的dish_ingredients关联
DELETE FROM dish_ingredients 
WHERE dish_id IN (SELECT id FROM dishes WHERE store_id = 7)
  AND ingredient_id IN (SELECT id FROM ingredients WHERE store_id = 6);

DELETE FROM dish_ingredients 
WHERE dish_id IN (SELECT id FROM dishes WHERE store_id = 6)
  AND ingredient_id IN (SELECT id FROM ingredients WHERE store_id = 7);

-- ============================================
-- 第五步：为每个店铺的菜品创建正确的食材关联
-- ============================================

-- 为北辰店的菜品创建食材关联（使用北辰店的食材）
INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity)
SELECT 
    d_north.id as dish_id,
    i_north.id as ingredient_id,
    di.quantity
FROM dishes d_north
JOIN dish_ingredients di ON d_north.name = (
    SELECT d.name FROM dishes d WHERE d.id = di.dish_id LIMIT 1
)
JOIN ingredients i_north ON i_north.name = (
    SELECT i.name FROM ingredients i WHERE i.id = di.ingredient_id LIMIT 1
)
WHERE d_north.store_id = 7  -- 北辰店
  AND i_north.store_id = 7  -- 北辰店
  AND NOT EXISTS (
    SELECT 1 FROM dish_ingredients di2 
    WHERE di2.dish_id = d_north.id 
      AND di2.ingredient_id = i_north.id
  );

-- 为西青店的菜品创建食材关联（使用西青店的食材）
INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity)
SELECT 
    d_west.id as dish_id,
    i_west.id as ingredient_id,
    di.quantity
FROM dishes d_west
JOIN dish_ingredients di ON d_west.name = (
    SELECT d.name FROM dishes d WHERE d.id = di.dish_id LIMIT 1
)
JOIN ingredients i_west ON i_west.name = (
    SELECT i.name FROM ingredients i WHERE i.id = di.ingredient_id LIMIT 1
)
WHERE d_west.store_id = 6  -- 西青店
  AND i_west.store_id = 6  -- 西青店
  AND NOT EXISTS (
    SELECT 1 FROM dish_ingredients di2 
    WHERE di2.dish_id = d_west.id 
      AND di2.ingredient_id = i_west.id
  );

-- ============================================
-- 第六步：验证修复结果
-- ============================================

-- 检查是否还有跨店关联（应该为空）
SELECT '=== 检查跨店关联（应该为空）===' as info;
SELECT 
    di.id as relation_id,
    d.id as dish_id,
    d.name as dish_name,
    d.store_id as dish_store_id,
    s_dish.name as dish_store_name,
    i.id as ingredient_id,
    i.name as ingredient_name,
    i.store_id as ingredient_store_id,
    s_ingredient.name as ingredient_store_name
FROM dish_ingredients di
JOIN dishes d ON di.dish_id = d.id
JOIN ingredients i ON di.ingredient_id = i.id
JOIN stores s_dish ON d.store_id = s_dish.id
JOIN stores s_ingredient ON i.store_id = s_ingredient.id
WHERE d.store_id != i.store_id;

-- 统计每个店铺的菜品数量
SELECT '=== 每个店铺的菜品数量 ===' as info;
SELECT s.id, s.name, COUNT(d.id) as dish_count
FROM stores s
LEFT JOIN dishes d ON s.id = d.store_id
GROUP BY s.id, s.name;

-- 统计每个店铺的食材数量
SELECT '=== 每个店铺的食材数量 ===' as info;
SELECT s.id, s.name, COUNT(i.id) as ingredient_count
FROM stores s
LEFT JOIN ingredients i ON s.id = i.store_id
GROUP BY s.id, s.name;

-- 统计每个店铺的dish_ingredients关联数量
SELECT '=== 每个店铺的dish_ingredients关联数量 ===' as info;
SELECT 
    d.store_id,
    s.name as store_name,
    COUNT(di.id) as relation_count
FROM dish_ingredients di
JOIN dishes d ON di.dish_id = d.id
JOIN stores s ON d.store_id = s.id
GROUP BY d.store_id, s.name;
