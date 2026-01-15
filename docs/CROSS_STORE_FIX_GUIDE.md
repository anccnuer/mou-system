# 跨店数据修复指南

## 问题说明

当前数据库中存在菜品和食材跨店关联的问题：
- 菜品属于北辰店（store_id: 7）
- 食材属于西青店（store_id: 6）
- 这导致菜品-食材关联表（dish_ingredients）中存在跨店数据

## 修复目标

确保每个店铺都有完整的菜品和食材数据，且菜品-食材关联在同一店铺内：
- 西青店（store_id: 6）拥有自己的菜品和食材
- 北辰店（store_id: 7）拥有自己的菜品和食材
- 菜品-食材关联在同一店铺内

## 修复脚本说明

### 1. 分析脚本
`migrations/003_analyze_cross_store_data.sql` - 分析当前数据状况

### 2. 修复脚本
`migrations/004_fix_cross_store_data.sql` - 完整的修复脚本
`migrations/005_fix_cross_store_data_simple.sql` - 简化版修复脚本（推荐）

## 执行方法

### 方法一：使用 Turso CLI（推荐）

1. 安装 Turso CLI
```bash
curl -sSfL https://get.turso.dev | sh
```

2. 登录 Turso
```bash
turso auth login
```

3. 执行修复脚本
```bash
turso db shell <your-database-name> < migrations/005_fix_cross_store_data_simple.sql
```

### 方法二：使用 wrangler（Cloudflare Workers）

1. 设置环境变量
```bash
set TURSO_DATABASE_URL=your-turso-database-url
set TURSO_AUTH_TOKEN=your-turso-auth-token
```

2. 使用 Node.js 脚本执行
```bash
node scripts/fix-cross-store-data.mjs
```

### 方法三：直接在 Turso Dashboard 执行

1. 访问 https://turso.tech/dashboard
2. 选择你的数据库
3. 点击 "Console" 或 "SQL Editor"
4. 复制 `migrations/005_fix_cross_store_data_simple.sql` 的内容
5. 粘贴到 SQL 编辑器中执行

## 修复步骤

脚本会自动执行以下步骤：

1. **查看当前数据状况**
   - 显示所有店铺
   - 显示跨店关联数据

2. **复制食材到缺失的店铺**
   - 将西青店的食材复制到北辰店
   - 将北辰店的食材复制到西青店

3. **复制菜品到缺失的店铺**
   - 将北辰店的菜品复制到西青店
   - 将西青店的菜品复制到北辰店

4. **删除跨店关联**
   - 删除所有跨店的 dish_ingredients 关联

5. **创建正确的食材关联**
   - 为北辰店的菜品创建食材关联（使用北辰店的食材）
   - 为西青店的菜品创建食材关联（使用西青店的食材）

6. **验证修复结果**
   - 检查是否还有跨店关联（应该为空）
   - 统计每个店铺的菜品数量
   - 统计每个店铺的食材数量
   - 统计每个店铺的 dish_ingredients 关联数量

## 预期结果

修复后：
- ✅ 没有跨店关联数据
- ✅ 每个店铺都有完整的菜品数据
- ✅ 每个店铺都有完整的食材数据
- ✅ 菜品-食材关联在同一店铺内

## 注意事项

1. **备份数据**：执行修复前，建议先备份数据库
2. **测试环境**：建议先在测试环境中执行，确认无误后再在生产环境执行
3. **执行时间**：根据数据量大小，执行时间可能从几秒到几分钟不等
4. **事务性**：脚本设计为幂等的，可以多次执行而不会产生重复数据

## 验证修复

执行完成后，检查以下内容：

1. 跨店关联查询结果为空
2. 每个店铺的菜品数量相同
3. 每个店铺的食材数量相同
4. 每个店铺的 dish_ingredients 关联数量相同

## 回滚方案

如果修复出现问题，可以：
1. 从备份恢复数据库
2. 或者手动删除重复的数据

## 联系支持

如果遇到问题，请查看：
- Turso 文档: https://docs.turso.tech/
- Cloudflare Workers 文档: https://developers.cloudflare.com/workers/
