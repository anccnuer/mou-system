-- 数据分析和修复脚本
-- 问题：菜品和食材跨店关联
-- 目标：确保每个店铺都有完整的菜品和食材数据，且菜品-食材关联在同一店铺内

-- ============================================
-- 第一步：分析当前数据状况
-- ============================================

-- 查看所有店铺
SELECT '=== 所有店铺 ===' as info;
SELECT id, name FROM stores;

-- 查看所有菜品及其所属店铺
SELECT '=== 所有菜品 ===' as info;
SELECT d.id, d.name, d.store_id, s.name as store_name
FROM dishes d
JOIN stores s ON d.store_id = s.id
ORDER BY d.store_id, d.id;

-- 查看所有食材及其所属店铺
SELECT '=== 所有食材 ===' as info;
SELECT i.id, i.name, i.store_id, s.name as store_name
FROM ingredients i
JOIN stores s ON i.store_id = s.id
ORDER BY i.store_id, i.id;

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
    s_ingredient.name as ingredient_store_name,
    di.quantity
FROM dish_ingredients di
JOIN dishes d ON di.dish_id = d.id
JOIN ingredients i ON di.ingredient_id = i.id
JOIN stores s_dish ON d.store_id = s_dish.id
JOIN stores s_ingredient ON i.store_id = s_ingredient.id
WHERE d.store_id != i.store_id
ORDER BY d.store_id, d.id;

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

-- 统计跨店关联数量
SELECT '=== 跨店关联统计 ===' as info;
SELECT 
    d.store_id as dish_store_id,
    s_dish.name as dish_store_name,
    i.store_id as ingredient_store_id,
    s_ingredient.name as ingredient_store_name,
    COUNT(*) as count
FROM dish_ingredients di
JOIN dishes d ON di.dish_id = d.id
JOIN ingredients i ON di.ingredient_id = i.id
JOIN stores s_dish ON d.store_id = s_dish.id
JOIN stores s_ingredient ON i.store_id = s_ingredient.id
WHERE d.store_id != i.store_id
GROUP BY d.store_id, i.store_id, s_dish.name, s_ingredient.name;

-- 查看每个菜品需要的食材
SELECT '=== 每个菜品需要的食材 ===' as info;
SELECT 
    d.id as dish_id,
    d.name as dish_name,
    d.store_id as dish_store_id,
    s_dish.name as dish_store_name,
    i.id as ingredient_id,
    i.name as ingredient_name,
    i.store_id as ingredient_store_id,
    s_ingredient.name as ingredient_store_name,
    di.quantity
FROM dish_ingredients di
JOIN dishes d ON di.dish_id = d.id
JOIN ingredients i ON di.ingredient_id = i.id
JOIN stores s_dish ON d.store_id = s_dish.id
JOIN stores s_ingredient ON i.store_id = s_ingredient.id
ORDER BY d.store_id, d.id, i.id;
