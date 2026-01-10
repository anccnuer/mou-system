import { Context, Next } from 'hono';
import { initializeDatabase } from '../db';
import type { Env } from '../types';

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`${method} ${path} - ${c.res.status} - ${duration}ms`);
}

export async function errorHandlerMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return c.json({
      success: false,
      error: errorMessage,
    }, 500);
  }
}

export async function databaseMiddleware(c: Context, next: Next) {
  try {
    await initializeDatabase(c.env as any);
    await next();
  } catch (error) {
    console.error('Database initialization error:', error);
    return c.json({
      success: false,
      error: 'Database initialization failed',
    }, 500);
  }
}

export * from './auth';
