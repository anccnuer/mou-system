import type { Context, Next } from 'hono';
import type { Env } from '../types';

const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = '7d';

export interface JWTPayload {
  sub: string;
  username: string;
  role: string;
}

export interface Variables {
  userId: number;
  username: string;
  role: string;
}

async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function base64UrlEncode(data: Uint8Array): Promise<string> {
  let binary = '';
  const bytes = new Uint8Array(data);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const encoded = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return Promise.resolve(encoded);
}

async function base64UrlDecode(str: string): Promise<Uint8Array> {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function generateToken(payload: JWTPayload): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (7 * 24 * 60 * 60);

  const tokenPayload = {
    ...payload,
    iat: now,
    exp: exp
  };

  const encoder = new TextEncoder();
  const encodedHeader = await base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = await base64UrlEncode(encoder.encode(JSON.stringify(tokenPayload)));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await importKey(JWT_SECRET);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  const encodedSignature = await base64UrlEncode(new Uint8Array(signature));
  return `${data}.${encodedSignature}`;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await importKey(JWT_SECRET);
    const encoder = new TextEncoder();
    const signature = await base64UrlDecode(encodedSignature);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(data)
    );

    if (!isValid) {
      return null;
    }

    const payloadData = await base64UrlDecode(encodedPayload);
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(payloadData));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload as JWTPayload;
  } catch (error) {
    return null;
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export async function authMiddleware(c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: '未登录' }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: '登录已过期' }, 401);
  }

  c.set('userId', parseInt(payload.sub));
  c.set('username', payload.username);
  c.set('role', payload.role);

  await next();
}

export async function adminMiddleware(c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) {
  const role = c.get('role');
  
  if (role !== 'admin') {
    return c.json({ error: '无权限访问' }, 403);
  }

  await next();
}

export async function optionalAuthMiddleware(c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      c.set('userId', parseInt(payload.sub));
      c.set('username', payload.username);
      c.set('role', payload.role);
    }
  }

  await next();
}

export { hashPassword, verifyPassword };
