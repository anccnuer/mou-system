import { Context, Next } from 'hono';
import { initializeDatabase } from '../db';
import type { Env } from '../types';

export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const corsDomains = c.env.CORS_DOMAINS;
  const allowedOrigins = corsDomains ? corsDomains.split(',').map(d => d.trim()) : '*';
  
  const origin = c.req.header('Origin');
  const isAllowed = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin));
  
  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    c.header('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  }
  
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (c.req.method === 'OPTIONS') {
    return c.newResponse(null, 204);
  }
  
  await next();
}

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
