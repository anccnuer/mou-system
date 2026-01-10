## 使用 Hono 官方 CORS 中间件优化跨域预检请求

### 实施步骤：

1. **安装 @hono/cors 包**
   - 运行 `npm install @hono/cors` 安装官方 CORS 中间件

2. **修改 src/index.ts**
   - 更新导入语句，添加 `import { cors } from 'hono/cors';`
   - 将 `app.use('*', corsMiddleware);` 替换为官方 CORS 中间件配置
   - 配置参数：
     - `origin`: 从环境变量 `CORS_DOMAINS` 读取（支持多个域名，动态匹配）
     - `maxAge`: 设置为 86400 秒（24小时）
     - `allowMethods`: GET, POST, PUT, DELETE, OPTIONS
     - `allowHeaders`: Content-Type, Authorization
     - `credentials`: true（如果需要支持带凭证的请求）

3. **更新 src/middleware/index.ts**
   - 移除自定义的 `corsMiddleware` 函数（第 5-26 行）
   - 从导出中移除 `corsMiddleware`

### 预期效果：
- 浏览器将缓存预检请求结果 24 小时
- 显著减少跨域请求的延迟
- 减少服务器 OPTIONS 请求的处理负担
- 使用官方中间件，更稳定、易维护