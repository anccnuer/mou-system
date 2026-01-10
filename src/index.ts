import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loggerMiddleware, errorHandlerMiddleware } from './middleware';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import storesRouter from './routes/stores';
import ingredientsRouter from './routes/ingredients';
import dishesRouter from './routes/dishes';
import operationLogsRouter from './routes/operation-logs';
import { adminUserExists, createDefaultAdminUser, hashPassword, initializeDatabase, getDatabaseClient, getUserByIdWithPassword, verifyPassword, updateUserPassword } from './db';
import { verifyToken } from './middleware/auth';
import type { ChangePasswordRequest } from './types';

type Env = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  ENVIRONMENT?: string;
  CORS_DOMAINS?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', errorHandlerMiddleware);
app.use('*', cors({
  origin: (origin, c) => {
    const corsDomains = c.env.CORS_DOMAINS;
    const allowedOrigins = corsDomains ? corsDomains.split(',').map((d: string) => d.trim()) : '*';
    
    if (allowedOrigins === '*') {
      return '*';
    }
    
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }
    
    return allowedOrigins[0] || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
  credentials: true,
}));
app.use('*', loggerMiddleware);

app.get('/', async (c) => {
  try {
    await initializeDatabase(c.env);
    const existingAdmin = await adminUserExists(c.env);
    if (!existingAdmin) {
      const adminPasswordHash = await hashPassword('123');
      await createDefaultAdminUser(c.env, adminPasswordHash);
      console.log('默认管理员账户已创建: admin / 123');
    }
  } catch (error) {
    console.error('Error initializing default admin:', error);
  }
  
  return c.json({
    message: 'Welcome to Inventory Management System API',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      users: '/users',
      stores: '/stores',
      ingredients: '/ingredients',
      dishes: '/dishes',
      operationLogs: '/operation-logs',
      init: '/init',
    },
  });
});

app.post('/init', async (c) => {
  try {
    await initializeDatabase(c.env);
    return c.json({
      success: true,
      message: 'Database initialized successfully',
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return c.json({
      success: false,
      error: 'Database initialization failed',
    }, 500);
  }
});

app.route('/auth', authRouter);
app.route('/users', usersRouter);
app.route('/stores', storesRouter);
app.route('/ingredients', ingredientsRouter);
app.route('/dishes', dishesRouter);
app.route('/operation-logs', operationLogsRouter);

app.get('/ingredients-table', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE store_id = ? ORDER BY id',
    args: [storeId]
  });
  return c.json(result.rows);
});

app.get('/ingredients-options', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT id, name, unit FROM ingredients WHERE store_id = ? ORDER BY name',
    args: [storeId]
  });
  return c.json(result.rows);
});

app.get('/dishes-table', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM dishes WHERE store_id = ? ORDER BY id',
    args: [storeId]
  });
  return c.json(result.rows);
});

app.get('/ingredient-consumption', async (c) => {
  const year = c.req.query('year') ? parseInt(c.req.query('year') as string) : new Date().getFullYear();
  const month = c.req.query('month') ? parseInt(c.req.query('month') as string) : new Date().getMonth() + 1;
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  
  const monthStr = month.toString().padStart(2, '0');
  const datePattern = `${year}-${monthStr}`;
  
  const client = getDatabaseClient(c.env);
  const logs = await client.execute({
    sql: `
      SELECT id, operation_type, operation_time, details
      FROM operation_logs
      WHERE operation_type IN ('dish_use', 'dish_batch_use')
        AND is_revoked = 0
        AND store_id = ?
        AND strftime('%Y-%m', operation_time) = ?
      ORDER BY operation_time
    `,
    args: [storeId, datePattern]
  });
  
  const consumptionMap = new Map<number, any>();
  
  for (const log of logs.rows) {
    const details = JSON.parse((log as any).details);
    
    if ((log as any).operation_type === 'dish_use' && details.used_ingredients) {
      for (const ing of details.used_ingredients) {
        const key = ing.ingredient_id;
        if (!consumptionMap.has(key)) {
          consumptionMap.set(key, {
            ingredient_id: ing.ingredient_id,
            ingredient_name: ing.ingredient_name,
            unit: '',
            total_quantity: 0,
            use_count: 0
          });
        }
        const data = consumptionMap.get(key)!;
        data.total_quantity += ing.quantity;
        data.use_count += 1;
      }
    } else if ((log as any).operation_type === 'dish_batch_use' && details.batch_results) {
      for (const result of details.batch_results) {
        if (result.success && result.used_ingredients) {
          for (const ing of result.used_ingredients) {
            const key = ing.ingredient_id;
            if (!consumptionMap.has(key)) {
              consumptionMap.set(key, {
                ingredient_id: ing.ingredient_id,
                ingredient_name: ing.ingredient_name,
                unit: '',
                total_quantity: 0,
                use_count: 0
              });
            }
            const data = consumptionMap.get(key)!;
            data.total_quantity += ing.quantity;
            data.use_count += 1;
          }
        }
      }
    }
  }
  
  const result = Array.from(consumptionMap.values());
  
  for (const item of result) {
    const ingredientResult = await client.execute({
      sql: 'SELECT unit FROM ingredients WHERE id = ?',
      args: [item.ingredient_id]
    });
    if (ingredientResult.rows.length > 0) {
      item.unit = (ingredientResult.rows[0] as any).unit;
    }
  }
  
  result.sort((a, b) => b.total_quantity - a.total_quantity);
  
  return c.json(result);
});

app.post('/change-password', async (c) => {
  const body = await c.req.json<ChangePasswordRequest>();
  const { oldPassword, newPassword } = body;

  if (!oldPassword || !newPassword) {
    return c.json({ error: '原密码和新密码不能为空' }, 400);
  }

  if (newPassword.length < 3) {
    return c.json({ error: '新密码长度至少3个字符' }, 400);
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: '未登录' }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: '登录已过期' }, 401);
  }

  const userId = parseInt(payload.sub);
  const user = await getUserByIdWithPassword(c.env, userId);
  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }

  const isValid = await verifyPassword(oldPassword, user.password as string);
  if (!isValid) {
    return c.json({ error: '原密码错误' }, 401);
  }

  const newPasswordHash = await hashPassword(newPassword);
  await updateUserPassword(c.env, user.id, newPasswordHash);

  return c.json({ message: '密码修改成功' });
});

export default app;
