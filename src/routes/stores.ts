import { Hono } from 'hono';
import { getDatabaseClient, getAllStores, createStore, deleteStore } from '../db';
import type { Env } from '../types';

const storesRouter = new Hono<{ Bindings: Env }>();

storesRouter.get('/', async (c) => {
  const stores = await getAllStores(c.env);
  return c.json(stores);
});

storesRouter.post('/', async (c) => {
  const body = await c.req.json<{ name: string }>();
  const { name } = body;
  const store = await createStore(c.env, name);
  return c.json(store);
});

storesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const storeId = parseInt(id);
  
  const client = getDatabaseClient(c.env);
  
  const ingredientCount = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM ingredients WHERE store_id = ?',
    args: [storeId]
  });
  
  const dishCount = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM dishes WHERE store_id = ?',
    args: [storeId]
  });
  
  const ingCount = (ingredientCount.rows[0] as any).count as number;
  const dCount = (dishCount.rows[0] as any).count as number;
  
  if (ingCount > 0 || dCount > 0) {
    return c.json({ error: '该店铺下还有食材或菜品，无法删除' });
  }
  
  const result = await deleteStore(c.env, storeId);
  if (result.changes === 0) {
    return c.json({ error: '店铺不存在' });
  }
  return c.json({ message: '店铺删除成功' });
});

export default storesRouter;
