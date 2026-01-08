import { Hono } from 'hono';
import { getDatabaseClient } from '../db';
import type { Resource, CreateResourceInput, UpdateResourceInput, ApiResponse, Env } from '../types';

const resourcesRouter = new Hono<{ Bindings: Env }>();

resourcesRouter.get('/', async (c) => {
  try {
    const client = getDatabaseClient(c.env);
    const result = await client.execute('SELECT * FROM resources ORDER BY created_at DESC');
    
    const response: ApiResponse<Resource[]> = {
      success: true,
      data: result.rows as unknown as Resource[],
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch resources',
    };
    return c.json(response, 500);
  }
});

resourcesRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const client = getDatabaseClient(c.env);
    const result = await client.execute({
      sql: 'SELECT * FROM resources WHERE id = ?',
      args: [id],
    });
    
    if (result.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Resource not found',
      };
      return c.json(response, 404);
    }
    
    const response: ApiResponse<Resource> = {
      success: true,
      data: result.rows[0] as unknown as Resource,
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch resource',
    };
    return c.json(response, 500);
  }
});

resourcesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateResourceInput>();
    
    if (!body.name || !body.description) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Name and description are required',
      };
      return c.json(response, 400);
    }
    
    const client = getDatabaseClient(c.env);
    const result = await client.execute({
      sql: 'INSERT INTO resources (name, description) VALUES (?, ?) RETURNING *',
      args: [body.name, body.description],
    });
    
    const response: ApiResponse<Resource> = {
      success: true,
      data: result.rows[0] as unknown as Resource,
      message: 'Resource created successfully',
    };
    
    return c.json(response, 201);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to create resource',
    };
    return c.json(response, 500);
  }
});

resourcesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<UpdateResourceInput>();
    
    const client = getDatabaseClient(c.env);
    
    const existing = await client.execute({
      sql: 'SELECT * FROM resources WHERE id = ?',
      args: [id],
    });
    
    if (existing.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Resource not found',
      };
      return c.json(response, 404);
    }
    
    const updates: string[] = [];
    const args: (string | number)[] = [];
    
    if (body.name !== undefined) {
      updates.push('name = ?');
      args.push(body.name);
    }
    
    if (body.description !== undefined) {
      updates.push('description = ?');
      args.push(body.description);
    }
    
    updates.push('updated_at = datetime(\'now\')');
    args.push(id);
    
    const result = await client.execute({
      sql: `UPDATE resources SET ${updates.join(', ')} WHERE id = ? RETURNING *`,
      args,
    });
    
    const response: ApiResponse<Resource> = {
      success: true,
      data: result.rows[0] as unknown as Resource,
      message: 'Resource updated successfully',
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update resource',
    };
    return c.json(response, 500);
  }
});

resourcesRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const client = getDatabaseClient(c.env);
    
    const existing = await client.execute({
      sql: 'SELECT * FROM resources WHERE id = ?',
      args: [id],
    });
    
    if (existing.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Resource not found',
      };
      return c.json(response, 404);
    }
    
    await client.execute({
      sql: 'DELETE FROM resources WHERE id = ?',
      args: [id],
    });
    
    const response: ApiResponse<null> = {
      success: true,
      message: 'Resource deleted successfully',
    };
    
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to delete resource',
    };
    return c.json(response, 500);
  }
});

export default resourcesRouter;
