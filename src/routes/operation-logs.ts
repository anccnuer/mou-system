import { Hono } from 'hono';
import { getDatabaseClient, getOperationLogs, getOperationLogById, revokeOperation } from '../db';
import { optionalAuthMiddleware, verifyToken, Variables } from '../middleware/auth';
import type { Env } from '../types';

const operationLogsRouter = new Hono<{ Bindings: Env, Variables: Variables }>();

operationLogsRouter.get('/', optionalAuthMiddleware, async (c) => {
  const storeId = c.req.query('store_id') ? parseInt(c.req.query('store_id') as string) : 1;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit') as string) : 50;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset') as string) : 0;
  
  const logs = await getOperationLogs(c.env, storeId, limit, offset);
  return c.json(logs);
});

operationLogsRouter.get('/:id', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const log = await getOperationLogById(c.env, parseInt(id));
  if (!log) {
    return c.json({ error: '操作记录不存在' });
  }
  return c.json(log);
});

operationLogsRouter.post('/revoke/:id', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const logId = parseInt(id);
  
  const log = await getOperationLogById(c.env, logId);
  if (!log) {
    return c.json({ error: '操作记录不存在' });
  }
  
  if (log.is_revoked) {
    return c.json({ error: '该操作已被撤回' });
  }
  
  const details = JSON.parse(log.details as string);
  let success = false;
  let error = '';
  
  const client = getDatabaseClient(c.env);
  
  switch (log.operation_type) {
    case 'ingredient_restock':
      const { ingredient_id, old_quantity } = details;
      await client.execute({
        sql: 'UPDATE ingredients SET quantity = ? WHERE id = ?',
        args: [old_quantity, ingredient_id]
      });
      success = true;
      break;
      
    case 'ingredient_edit':
      const { ingredient_id: edit_id, old_quantity: edit_old_quantity, old_unit: edit_old_unit } = details;
      await client.execute({
        sql: 'UPDATE ingredients SET quantity = ?, unit = ? WHERE id = ?',
        args: [edit_old_quantity, edit_old_unit, edit_id]
      });
      success = true;
      break;
      
    case 'ingredient_delete':
      const { deleted_ingredient } = details;
      await client.execute({
        sql: 'INSERT INTO ingredients (id, name, quantity, unit, store_id) VALUES (?, ?, ?, ?, ?)',
        args: [
          deleted_ingredient.id, 
          deleted_ingredient.name, 
          deleted_ingredient.quantity, 
          deleted_ingredient.unit, 
          deleted_ingredient.store_id
        ]
      });
      success = true;
      break;
      
    case 'dish_use':
      const { used_ingredients } = details;
      for (const ing of used_ingredients) {
        await client.execute({
          sql: 'UPDATE ingredients SET quantity = quantity + ? WHERE id = ?',
          args: [ing.quantity, ing.ingredient_id]
        });
      }
      success = true;
      break;
      
    case 'dish_batch_use':
      const { batch_results } = details;
      for (const result of batch_results) {
        if (result.success && result.used_ingredients) {
          for (const ing of result.used_ingredients) {
            await client.execute({
              sql: 'UPDATE ingredients SET quantity = quantity + ? WHERE id = ?',
              args: [ing.quantity, ing.ingredient_id]
            });
          }
        }
      }
      success = true;
      break;

    case 'ingredient_batch_add':
      const { batch_results: batch_add_results } = details;
      for (const result of batch_add_results) {
        if (result.success) {
          if (result.operation_type === 'add') {
            await client.execute({
              sql: 'DELETE FROM ingredients WHERE id = ?',
              args: [result.ingredient_id]
            });
          } else if (result.operation_type === 'restock') {
            await client.execute({
              sql: 'UPDATE ingredients SET quantity = ? WHERE id = ?',
              args: [result.old_quantity, result.ingredient_id]
            });
          }
        }
      }
      success = true;
      break;

    default:
      error = '不支持撤回此操作类型';
  }
  
  if (success) {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: '需要登录才能撤回操作' }, 401);
    }
    const revokeResult = await revokeOperation(c.env, logId, userId);
    return c.json({ message: '撤回成功', log: revokeResult.log });
  } else {
    return c.json({ error });
  }
});

export default operationLogsRouter;
