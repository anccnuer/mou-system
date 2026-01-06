import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db, initDatabase, createUser, getUserByUsername, getUserById, getUserByIdWithPassword, adminUserExists, createDefaultAdminUser, updateUserPassword } from './src/db';
import { join } from 'path';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = '7d';

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(':');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return key === derivedKey.toString('hex');
}

// 初始化数据库
initDatabase();

// 创建默认管理员用户
async function initDefaultAdmin() {
  const existingAdmin = adminUserExists();
  if (!existingAdmin) {
    const adminPasswordHash = await hashPassword('123');
    createDefaultAdminUser(adminPasswordHash);
    console.log('默认管理员账户已创建: admin / 123');
  }
}
initDefaultAdmin();

const app = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET,
      exp: JWT_EXPIRY
    })
  )
  // 根路由返回HTML页面
  .get('/', () => {
    return new Response(Bun.file(join(process.cwd(), 'public', 'index.html')), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  })

  // 处理静态文件请求
  .get('/*', ({ params }) => {
    const filePath = join(process.cwd(), 'public', params['*']);
    const file = Bun.file(filePath);
    return file.exists().then(exists => {
      if (exists) {
        return new Response(file);
      } else {
        return new Response('Not Found', { status: 404 });
      }
    });
  })

  // 获取当前用户状态
  .get('/auth/me', async ({ jwt, request }) => {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return { authenticated: false };
    }

    const payload = await jwt.verify(token);
    if (!payload) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        id: payload.sub,
        username: payload.username
      }
    };
  })

  // 用户登录
  .post('/auth/login', async ({ body, jwt }) => {
    const { username, password } = body as { username: string; password: string };

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userWithoutPassword = {
      id: user.id,
      username: user.username
    };

    const token = await jwt.sign({
      sub: user.id,
      username: user.username
    });

    return {
      message: '登录成功',
      user: userWithoutPassword,
      token
    };
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  })

  // 用户登出
  .post('/auth/logout', () => {
    return { message: '登出成功' };
  })

  // 修改密码
  .post('/auth/change-password', async ({ request, body, jwt }) => {
    const { oldPassword, newPassword } = body as { oldPassword: string; newPassword: string };

    if (!oldPassword || !newPassword) {
      return new Response(JSON.stringify({ error: '原密码和新密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (newPassword.length < 3) {
      return new Response(JSON.stringify({ error: '新密码长度至少3个字符' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await jwt.verify(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: '登录已过期' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = Number(payload.sub);
    const user = getUserByIdWithPassword(userId);
    if (!user) {
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isValid = await verifyPassword(oldPassword, user.password);
    if (!isValid) {
      return new Response(JSON.stringify({ error: '原密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newPasswordHash = await hashPassword(newPassword);
    updateUserPassword(user.id, newPasswordHash);

    return { message: '密码修改成功' };
  }, {
    body: t.Object({
      oldPassword: t.String(),
      newPassword: t.String()
    })
  })

  // 食材管理 API
  // 获取所有食材
  .get('/ingredients', () => {
    const ingredients = db.prepare('SELECT * FROM ingredients ORDER BY id').all();
    return ingredients;
  })

  // 获取单个食材
  .get('/ingredients/:id', ({ params }) => {
    const { id } = params;
    const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
    if (!ingredient) {
      return new Response('食材不存在', { status: 404 });
    }
    return ingredient;
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  // 添加新食材 - 接受name、quantity和unit三个参数
  .post('/ingredients', ({ body }) => {
    const { name, quantity, unit } = body;
    db.prepare('INSERT INTO ingredients (name, quantity, unit) VALUES (?, ?, ?)').run(name, quantity, unit);
    return db.prepare('SELECT * FROM ingredients WHERE name = ?').get(name);
  }, {
    body: t.Object({
      name: t.String(),
      quantity: t.Number(),
      unit: t.String()
    })
  })

  // 更新食材信息（包括库存和单位）
  .put('/ingredients/:id', ({ params, body }) => {
    const { id } = params;
    const { quantity, unit } = body;
    const result = db.prepare('UPDATE ingredients SET quantity = ?, unit = ? WHERE id = ?').run(quantity, unit, id);
    if (result.changes === 0) {
      return { error: '食材不存在' };
    }
    return db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      quantity: t.Number(),
      unit: t.String()
    })
  })

  // 删除食材
  .delete('/ingredients/:id', ({ params }) => {
    const { id } = params;
    const result = db.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
    if (result.changes === 0) {
      return { error: '食材不存在' };
    }
    return { message: '食材删除成功' };
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  // 菜品管理 API
  // 获取所有菜品
  .get('/dishes', () => {
    const dishes = db.prepare('SELECT * FROM dishes ORDER BY id').all();
    return dishes;
  })

  // 获取菜品详情（包含食材组成）
  .get('/dishes/:id', ({ params }) => {
    const { id } = params;
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
    if (!dish) {
      return { error: '菜品不存在' };
    }

    const ingredients = db.prepare(`
      SELECT i.id, i.name, i.unit, di.quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ?
    `).all(id);

    return {
      ...dish,
      ingredients
    };
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  // 添加新菜品
  .post('/dishes', ({ body }) => {
    const { name, ingredients } = body;
    
    // 插入菜品
    db.prepare('INSERT INTO dishes (name) VALUES (?)').run(name);
    const dish = db.prepare('SELECT * FROM dishes WHERE name = ?').get(name);
    const dishId = dish.id;

    // 插入菜品食材关联
    for (const ing of ingredients) {
      db.prepare(
        'INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?, ?, ?)'
      ).run(dishId, ing.ingredient_id, ing.quantity || 1);
    }

    // 返回包含食材的菜品详情
    const updatedIngredients = db.prepare(`
      SELECT i.id, i.name, di.quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ?
    `).all(dishId);
    
    return {
      ...dish,
      ingredients: updatedIngredients
    };
  }, {
    body: t.Object({
      name: t.String(),
      ingredients: t.Array(t.Object({
        ingredient_id: t.Number(),
        quantity: t.Optional(t.Number())
      }))
    })
  })

  // 删除菜品
  .delete('/dishes/:id', ({ params }) => {
    const { id } = params;
    const result = db.prepare('DELETE FROM dishes WHERE id = ?').run(id);
    if (result.changes === 0) {
      return { error: '菜品不存在' };
    }
    return { message: '菜品删除成功' };
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  // 使用菜品，减少食材库存
  .post('/dishes/:id/use', ({ params, query }) => {
    const { id } = params;
    const quantity = parseInt(query.quantity || '1');
    
    console.log('收到使用菜品请求:', { id, query, quantity });
    
    // 检查菜品是否存在
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
    if (!dish) {
      return { error: '菜品不存在' };
    }

    // 获取菜品所需的所有食材ID和数量（不JOIN，只获取关联关系）
    const requiredIngredients = db.prepare(`
      SELECT di.ingredient_id, di.quantity AS required_quantity
      FROM dish_ingredients di
      WHERE di.dish_id = ?
    `).all(id);

    // 检查是否有任何所需食材
    if (requiredIngredients.length === 0) {
      return { error: '该菜品没有配置任何食材，无法使用' };
    }

    // 获取菜品所需食材及其当前库存
    const ingredients = db.prepare(`
      SELECT i.id, i.name, i.quantity AS current_quantity, di.quantity AS required_quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ?
    `).all(id);

    // 检查是否所有所需食材都存在
    if (ingredients.length < requiredIngredients.length) {
      return { error: '该菜品所需的某些食材已被删除，无法使用' };
    }

    // 检查食材库存是否足够（考虑使用数量）
    for (const ing of ingredients) {
      const totalNeeded = ing.required_quantity * quantity;
      if (ing.current_quantity < totalNeeded) {
        return { error: `${ing.name} 库存不足，需要 ${totalNeeded}，当前库存: ${ing.current_quantity}` };
      }
    }

    // 减少食材库存（考虑使用数量）
    for (const ing of ingredients) {
      const totalQuantity = ing.required_quantity * quantity;
      console.log(`减少食材 ${ing.name} 库存: ${ing.current_quantity} - ${totalQuantity}`);
      db.prepare('UPDATE ingredients SET quantity = quantity - ? WHERE id = ?').run(totalQuantity, ing.id);
    }

    // 返回更新后的菜品信息和食材库存
    const updatedIngredients = db.prepare(`
      SELECT i.id, i.name, i.quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ?
    `).all(id);

    return {
      dish,
      updatedIngredients
    };
  }, {
    params: t.Object({
      id: t.String()
    }),
    query: t.Object({
      quantity: t.Optional(t.String())
    })
  })

  // 批量使用菜品
  .post('/dishes/batch-use', async ({ body }) => {
    const { dishes } = body as { dishes: Array<{ name: string; quantity: number }> };
    const results = [];
    
    for (const item of dishes) {
      const dish = db.prepare('SELECT * FROM dishes WHERE name = ?').get(item.name);
      if (!dish) {
        results.push({ name: item.name, success: false, error: '菜品不存在' });
        continue;
      }
      
      const ingredients = db.prepare(`
        SELECT i.id, i.name, i.quantity AS current_quantity, di.quantity AS required_quantity
        FROM dish_ingredients di
        JOIN ingredients i ON di.ingredient_id = i.id
        WHERE di.dish_id = ?
      `).all(dish.id);
      
      if (ingredients.length === 0) {
        results.push({ name: item.name, success: false, error: '该菜品没有配置食材' });
        continue;
      }
      
      for (const ing of ingredients) {
        const totalNeeded = ing.required_quantity * item.quantity;
        if (ing.current_quantity < totalNeeded) {
          results.push({ 
            name: item.name, 
            success: false, 
            error: `${ing.name} 库存不足，需要 ${totalNeeded}，当前 ${ing.current_quantity}` 
          });
          continue;
        }
      }
      
      for (const ing of ingredients) {
        db.prepare('UPDATE ingredients SET quantity = quantity - ? WHERE id = ?')
          .run(ing.required_quantity * item.quantity, ing.id);
      }
      
      results.push({ name: item.name, success: true });
    }
    
    return { results };
  }, {
    body: t.Object({
      dishes: t.Array(t.Object({
        name: t.String(),
        quantity: t.Number()
      }))
    })
  })

  // 前端动态内容 API - 现在返回JSON数据
  // 获取食材列表JSON
  .get('/ingredients-table', () => {
    const ingredients = db.prepare('SELECT * FROM ingredients ORDER BY id').all();
    return ingredients;
  })

  // 获取菜品列表JSON
  .get('/dishes-table', () => {
    const dishes = db.prepare('SELECT * FROM dishes ORDER BY id').all();
    return dishes;
  })

  // 获取菜品使用列表JSON
  .get('/use-dishes-table', () => {
    const dishes = db.prepare('SELECT * FROM dishes ORDER BY id').all();
    return dishes;
  })

  // 获取食材选项JSON
  .get('/ingredients-options', () => {
    const ingredients = db.prepare('SELECT id, name, unit FROM ingredients ORDER BY name').all();
    return ingredients;
  })

  .listen(3000);

console.log(`Server running at http://localhost:3000`);
