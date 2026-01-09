import { Hono } from 'hono';
import { getDatabaseClient, createOperationLog } from '../db';
import { optionalAuthMiddleware, verifyToken, Variables } from '../middleware/auth';
import type { Env, CreateDishRequest, BatchUseDishRequest } from '../types';

const dishesRouter = new Hono<{ Bindings: Env, Variables: Variables }>();

dishesRouter.get('/', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM dishes WHERE store_id = ? ORDER BY id',
    args: [storeId]
  });
  return c.json(result.rows);
});

dishesRouter.get('/dishes-table', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM dishes WHERE store_id = ? ORDER BY id',
    args: [storeId]
  });
  return c.json(result.rows);
});

dishesRouter.get('/use-dishes-table', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM dishes WHERE store_id = ? ORDER BY id',
    args: [storeId]
  });
  return c.json(result.rows);
});

dishesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM dishes WHERE id = ?',
    args: [id]
  });
  
  if (result.rows.length === 0) {
    return c.json({ error: '菜品不存在' });
  }

  const dish = result.rows[0];

  const ingredients = await client.execute({
    sql: `
      SELECT i.id, i.name, i.unit, di.quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ?
    `,
    args: [id]
  });

  return c.json({
    ...dish,
    ingredients: ingredients.rows
  });
});

dishesRouter.post('/', async (c) => {
  const body = await c.req.json<CreateDishRequest>();
  const { name, ingredients, store_id } = body;
  
  const client = getDatabaseClient(c.env);
  
  await client.execute({
    sql: 'INSERT INTO dishes (name, store_id) VALUES (?, ?)',
    args: [name, store_id]
  });
  
  const dishResult = await client.execute({
    sql: 'SELECT * FROM dishes WHERE name = ? AND store_id = ?',
    args: [name, store_id]
  });
  
  const dish = dishResult.rows[0];
  const dishId = dish.id;

  for (const ing of ingredients) {
    await client.execute({
      sql: 'INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?, ?, ?)',
      args: [dishId, ing.ingredient_id, ing.quantity || 1]
    });
  }

  const updatedIngredients = await client.execute({
    sql: `
      SELECT i.id, i.name, di.quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ?
    `,
    args: [dishId]
  });
  
  return c.json({
    ...dish,
    ingredients: updatedIngredients.rows
  });
});

dishesRouter.delete('/:id', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const client = getDatabaseClient(c.env);
  
  const result = await client.execute({
    sql: 'SELECT * FROM dishes WHERE id = ?',
    args: [id]
  });
  
  if (result.rows.length === 0) {
    return c.json({ error: '菜品不存在' });
  }
  
  const dish = result.rows[0] as any;
  
  await client.execute({
    sql: 'DELETE FROM dish_ingredients WHERE dish_id = ?',
    args: [id]
  });
  
  await client.execute({
    sql: 'DELETE FROM dishes WHERE id = ?',
    args: [id]
  });
  
  let userId = null;
  
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      userId = parseInt(payload.sub);
    }
  }
  
  await createOperationLog(c.env, 'dish_delete', userId, dish.store_id || 1, JSON.stringify({
    deleted_dish: dish
  }));
  
  return c.json({ success: true, message: '菜品删除成功' });
});

dishesRouter.post('/:id/use', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const quantity = c.req.query('quantity') ? parseInt(c.req.query('quantity') as string) : 1;
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  
  const client = getDatabaseClient(c.env);
  
  const dishResult = await client.execute({
    sql: 'SELECT * FROM dishes WHERE id = ?',
    args: [id]
  });
  
  if (dishResult.rows.length === 0) {
    return c.json({ error: '菜品不存在' });
  }

  const dish = dishResult.rows[0];

  const requiredIngredients = await client.execute({
    sql: `
      SELECT di.ingredient_id, di.quantity AS required_quantity
      FROM dish_ingredients di
      WHERE di.dish_id = ?
    `,
    args: [id]
  });

  if (requiredIngredients.rows.length === 0) {
    return c.json({ error: '该菜品没有配置任何食材，无法使用' });
  }

  const ingredients = await client.execute({
    sql: `
      SELECT i.id, i.name, i.quantity AS current_quantity, di.quantity AS required_quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ? AND i.store_id = ?
    `,
    args: [id, storeId]
  });

  if (ingredients.rows.length < requiredIngredients.rows.length) {
    return c.json({ error: '该菜品所需的某些食材已被删除或不在当前店铺，无法使用' });
  }

  for (const ing of ingredients.rows) {
    const totalNeeded = (ing as any).required_quantity * quantity;
    if ((ing as any).current_quantity < totalNeeded) {
      return c.json({ 
        error: `${(ing as any).name} 库存不足，需要 ${totalNeeded}，当前库存: ${(ing as any).current_quantity}` 
      });
    }
  }

  const usedIngredients = ingredients.rows.map(ing => ({
    ingredient_id: (ing as any).id,
    ingredient_name: (ing as any).name,
    quantity: (ing as any).required_quantity * quantity
  }));

  for (const ing of ingredients.rows) {
    const totalQuantity = (ing as any).required_quantity * quantity;
    await client.execute({
      sql: 'UPDATE ingredients SET quantity = quantity - ? WHERE id = ?',
      args: [totalQuantity, (ing as any).id]
    });
  }

  let userId = null;
  
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      userId = parseInt(payload.sub);
    }
  }
  
  await createOperationLog(c.env, 'dish_use', userId, storeId, JSON.stringify({
    dish_id: parseInt(id),
    dish_name: dish.name,
    quantity,
    used_ingredients: usedIngredients
  }));

  const updatedIngredients = await client.execute({
    sql: `
      SELECT i.id, i.name, i.quantity
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ? AND i.store_id = ?
    `,
    args: [id, storeId]
  });

  return c.json({
    dish,
    updatedIngredients: updatedIngredients.rows
  });
});

dishesRouter.post('/batch-use', optionalAuthMiddleware, async (c) => {
  const body = await c.req.json<BatchUseDishRequest>();
  const { dishes, store_id } = body;
  const results = [];
  
  const batchResults = [];
  const client = getDatabaseClient(c.env);
  
  for (const item of dishes) {
    const dishResult = await client.execute({
      sql: 'SELECT * FROM dishes WHERE name = ? AND store_id = ?',
      args: [item.name, store_id]
    });
    
    if (dishResult.rows.length === 0) {
      results.push({ name: item.name, success: false, error: '菜品不存在' });
      continue;
    }
    
    const dish = dishResult.rows[0];
    
    const ingredients = await client.execute({
      sql: `
        SELECT i.id, i.name, i.quantity AS current_quantity, di.quantity AS required_quantity
        FROM dish_ingredients di
        JOIN ingredients i ON di.ingredient_id = i.id
        WHERE di.dish_id = ? AND i.store_id = ?
      `,
      args: [dish.id, store_id]
    });
    
    if (ingredients.rows.length === 0) {
      results.push({ name: item.name, success: false, error: '该菜品没有配置食材' });
      continue;
    }
    
    for (const ing of ingredients.rows) {
      const totalNeeded = (ing as any).required_quantity * item.quantity;
      if ((ing as any).current_quantity < totalNeeded) {
        results.push({ 
          name: item.name, 
          success: false, 
          error: `${(ing as any).name} 库存不足，需要 ${totalNeeded}，当前 ${(ing as any).current_quantity}` 
        });
        continue;
      }
    }
    
    const usedIngredients = ingredients.rows.map(ing => ({
      ingredient_id: (ing as any).id,
      ingredient_name: (ing as any).name,
      quantity: (ing as any).required_quantity * item.quantity
    }));
    
    for (const ing of ingredients.rows) {
      await client.execute({
        sql: 'UPDATE ingredients SET quantity = quantity - ? WHERE id = ?',
        args: [(ing as any).required_quantity * item.quantity, (ing as any).id]
      });
    }
    
    results.push({ name: item.name, success: true });
    batchResults.push({
      name: item.name,
      success: true,
      used_ingredients: usedIngredients
    });
  }
  
  let userId = null;
  
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      userId = parseInt(payload.sub);
    }
  }
  
  await createOperationLog(c.env, 'dish_batch_use', userId, store_id, JSON.stringify({
    batch_results: batchResults
  }));
  
  return c.json({ results });
});

export default dishesRouter;
