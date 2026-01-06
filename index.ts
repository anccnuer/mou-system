import { Elysia, t } from 'elysia';
import { db, initDatabase } from './src/db';
import { join } from 'path';

// 初始化数据库
initDatabase();

const app = new Elysia()
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
      SELECT i.id, i.name, di.quantity
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
  .post('/dishes/:id/use', ({ params }) => {
    const { id } = params;
    
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

    // 检查食材库存是否足够
    for (const ing of ingredients) {
      if (ing.current_quantity < ing.required_quantity) {
        return { error: `${ing.name} 库存不足，当前库存: ${ing.current_quantity}，所需: ${ing.required_quantity}` };
      }
    }

    // 减少食材库存
    for (const ing of ingredients) {
      db.prepare('UPDATE ingredients SET quantity = quantity - ? WHERE id = ?').run(ing.required_quantity, ing.id);
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
