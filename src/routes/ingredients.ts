import { Hono } from 'hono';
import { getDatabaseClient, createOperationLog } from '../db';
import { optionalAuthMiddleware, verifyToken, Variables } from '../middleware/auth';
import type { Env, CreateIngredientRequest, UpdateIngredientRequest, IngredientConsumption, BatchCreateIngredientsRequest, BatchCreateIngredientResponse } from '../types';

const ingredientsRouter = new Hono<{ Bindings: Env, Variables: Variables }>();

ingredientsRouter.get('/', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE store_id = ? ORDER BY id',
    args: [storeId]
  });
  return c.json(result.rows);
});

ingredientsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE id = ?',
    args: [id]
  });
  
  if (result.rows.length === 0) {
    return c.text('食材不存在', 404);
  }
  return c.json(result.rows[0]);
});

ingredientsRouter.get('/ingredients-table', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE store_id = ? ORDER BY id',
    args: [storeId]
  });
  return c.json(result.rows);
});

ingredientsRouter.get('/ingredients-options', async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const client = getDatabaseClient(c.env);
  const result = await client.execute({
    sql: 'SELECT id, name, unit FROM ingredients WHERE store_id = ? ORDER BY name',
    args: [storeId]
  });
  return c.json(result.rows);
});

ingredientsRouter.post('/', optionalAuthMiddleware, async (c) => {
  const body = await c.req.json<CreateIngredientRequest>();
  const { name, quantity, unit, store_id } = body;
  
  const client = getDatabaseClient(c.env);
  
  const existingResult = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE name = ? AND store_id = ?',
    args: [name, store_id]
  });
  
  if (existingResult.rows.length > 0) {
    return c.json({ error: '该食材已存在' }, 400);
  }
  
  await client.execute({
    sql: 'INSERT INTO ingredients (name, quantity, unit, store_id) VALUES (?, ?, ?, ?)',
    args: [name, quantity, unit, store_id]
  });
  
  const result = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE name = ? AND store_id = ?',
    args: [name, store_id]
  });
  
  const ingredient = result.rows[0];
  let userId = null;
  
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      userId = parseInt(payload.sub);
    }
  }
  
  await createOperationLog(c.env, 'ingredient_add', userId, store_id, JSON.stringify({
    ingredient_id: ingredient.id,
    ingredient_name: name,
    quantity,
    unit
  }));
  
  return c.json(ingredient);
});

ingredientsRouter.post('/batch', optionalAuthMiddleware, async (c) => {
  const body = await c.req.json<BatchCreateIngredientsRequest>();
  const { ingredients, store_id } = body;
  const batchSize = c.req.query('batch_size') ? parseInt(c.req.query('batch_size') as string) : 50;

  if (!ingredients || ingredients.length === 0) {
    return c.json({ error: '食材列表不能为空' }, 400);
  }

  const client = getDatabaseClient(c.env);
  const response: BatchCreateIngredientResponse = {
    success: 0,
    failed: 0,
    errors: []
  };

  const batchResults: Array<{
    name: string;
    success: boolean;
    operation_type?: 'add' | 'restock';
    ingredient_id?: number;
    quantity?: number;
    old_quantity?: number;
    new_quantity?: number;
    unit?: string;
    error?: string;
  }> = [];

  let userId = null;
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      userId = parseInt(payload.sub);
    }
  }

  for (let i = 0; i < ingredients.length; i++) {
    const item = ingredients[i];
    const rowNumber = i + 1;

    if (!item.name || !item.unit) {
      response.failed++;
      response.errors.push({
        row: rowNumber,
        name: item.name || '未知',
        error: '名称和单位不能为空'
      });
      batchResults.push({
        name: item.name || '未知',
        success: false,
        error: '名称和单位不能为空'
      });
      continue;
    }

    const quantity = item.quantity !== undefined ? item.quantity : 0;

    try {
      const existingResult = await client.execute({
        sql: 'SELECT * FROM ingredients WHERE name = ? AND store_id = ?',
        args: [item.name, store_id]
      });

      if (existingResult.rows.length > 0) {
        const existingIngredient = existingResult.rows[0] as any;
        const oldQuantity = existingIngredient.quantity;
        const newQuantity = oldQuantity + quantity;

        await client.execute({
          sql: 'UPDATE ingredients SET quantity = ? WHERE id = ?',
          args: [newQuantity, existingIngredient.id]
        });

        response.success++;
        batchResults.push({
          name: item.name,
          success: true,
          operation_type: 'restock',
          ingredient_id: existingIngredient.id,
          quantity,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          unit: item.unit
        });
      } else {
        await client.execute({
          sql: 'INSERT INTO ingredients (name, quantity, unit, store_id) VALUES (?, ?, ?, ?)',
          args: [item.name, quantity, item.unit, store_id]
        });

        const result = await client.execute({
          sql: 'SELECT * FROM ingredients WHERE name = ? AND store_id = ? ORDER BY id DESC LIMIT 1',
          args: [item.name, store_id]
        });

        const ingredient = result.rows[0] as any;

        response.success++;
        batchResults.push({
          name: item.name,
          success: true,
          operation_type: 'add',
          ingredient_id: ingredient.id,
          quantity,
          old_quantity: 0,
          new_quantity: quantity,
          unit: item.unit
        });
      }
    } catch (error) {
      response.failed++;
      response.errors.push({
        row: rowNumber,
        name: item.name,
        error: '操作失败'
      });
      batchResults.push({
        name: item.name,
        success: false,
        error: '操作失败'
      });
    }
  }

  await createOperationLog(c.env, 'ingredient_batch_add', userId, store_id, JSON.stringify({
    batch_results: batchResults
  }));

  return c.json(response);
});

ingredientsRouter.put('/:id', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<UpdateIngredientRequest>();
  const { quantity, unit } = body;
  
  const client = getDatabaseClient(c.env);
  
  const oldResult = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE id = ?',
    args: [id]
  });
  
  if (oldResult.rows.length === 0) {
    return c.json({ error: '食材不存在' });
  }
  
  const oldIngredient = oldResult.rows[0] as any;
  
  await client.execute({
    sql: 'UPDATE ingredients SET quantity = ?, unit = ? WHERE id = ?',
    args: [quantity, unit, id]
  });
  
  let userId = null;
  
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      userId = parseInt(payload.sub);
    }
  }
  
  if (quantity > oldIngredient.quantity) {
    const restockQuantity = quantity - oldIngredient.quantity;
    await createOperationLog(c.env, 'ingredient_restock', userId, oldIngredient.store_id, JSON.stringify({
      ingredient_id: parseInt(id),
      ingredient_name: oldIngredient.name,
      restock_quantity: restockQuantity,
      old_quantity: oldIngredient.quantity,
      new_quantity: quantity,
      unit
    }));
  } else {
    await createOperationLog(c.env, 'ingredient_edit', userId, oldIngredient.store_id, JSON.stringify({
      ingredient_id: parseInt(id),
      ingredient_name: oldIngredient.name,
      old_quantity: oldIngredient.quantity,
      new_quantity: quantity,
      old_unit: oldIngredient.unit,
      new_unit: unit
    }));
  }
  
  const result = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE id = ?',
    args: [id]
  });
  return c.json(result.rows[0]);
});

ingredientsRouter.delete('/:id', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  
  const client = getDatabaseClient(c.env);
  
  const result = await client.execute({
    sql: 'SELECT * FROM ingredients WHERE id = ?',
    args: [id]
  });
  
  if (result.rows.length === 0) {
    return c.json({ error: '食材不存在' });
  }
  
  const ingredient = result.rows[0] as any;
  
  await client.execute({
    sql: 'DELETE FROM ingredients WHERE id = ?',
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
  
  await createOperationLog(c.env, 'ingredient_delete', userId, ingredient.store_id || 1, JSON.stringify({
    deleted_ingredient: ingredient
  }));
  
  return c.json({ message: '食材删除成功' });
});

ingredientsRouter.get('/ingredient-consumption', async (c) => {
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
  
  const consumptionMap = new Map<number, IngredientConsumption>();
  
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

export default ingredientsRouter;
