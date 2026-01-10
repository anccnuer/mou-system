import { createClient } from '@libsql/client';
import type { Env } from './types';

let client: ReturnType<typeof createClient> | null = null;

export function getDatabaseClient(env: Env) {
  if (client) {
    return client;
  }

  if (!env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required');
  }

  client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  return client;
}

export async function initializeDatabase(env: Env) {
  const client = getDatabaseClient(env);
  
  await client.execute(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '个',
      store_id INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      store_id INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS dish_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dish_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (dish_id) REFERENCES dishes(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operation_time TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      user_id INTEGER,
      store_id INTEGER NOT NULL,
      details TEXT NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      revoked_time TEXT,
      revoked_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (revoked_by) REFERENCES users(id)
    )
  `);

  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS trim_operation_logs
    AFTER INSERT ON operation_logs
    WHEN (
      SELECT COUNT(*) FROM operation_logs 
      WHERE store_id = NEW.store_id
    ) > 100
    BEGIN
      DELETE FROM operation_logs 
      WHERE store_id = NEW.store_id 
      AND id NOT IN (
        SELECT id FROM operation_logs 
        WHERE store_id = NEW.store_id 
        ORDER BY operation_time DESC 
        LIMIT 100
      );
    END
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_ingredients_store_id ON ingredients(store_id)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_dishes_store_id ON dishes(store_id)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish_id ON dish_ingredients(dish_id)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient_id ON dish_ingredients(ingredient_id)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_operation_logs_store_id ON operation_logs(store_id)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_time ON operation_logs(operation_time)
  `);

  await client.execute(`
    INSERT OR IGNORE INTO stores (id, name) VALUES (1, '默认店铺')
  `);

  await client.execute(`
    UPDATE ingredients SET store_id = 1 WHERE store_id IS NULL OR store_id = 0
  `);

  await client.execute(`
    UPDATE dishes SET store_id = 1 WHERE store_id IS NULL OR store_id = 0
  `);

  await client.execute(`
    UPDATE users SET role = 'admin' WHERE username = 'admin' AND role IS NULL
  `);

  await client.execute(`
    UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''
  `);

  console.log('Database initialized successfully');
}

export async function closeDatabase() {
  if (client) {
    client = null;
  }
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
  return Promise.resolve(bytes);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export async function getUserByUsername(env: Env, username: string): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username]
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getUserById(env: Env, id: number): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'SELECT id, username, role, created_at FROM users WHERE id = ?',
    args: [id]
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getUserByIdWithPassword(env: Env, id: number): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id]
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function adminUserExists(env: Env): Promise<boolean> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: ['admin']
  });
  return result.rows.length > 0;
}

export async function createDefaultAdminUser(env: Env, passwordHash: string): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'INSERT INTO users (username, password, role) VALUES (?, ?, ?) RETURNING *',
    args: ['admin', passwordHash, 'admin']
  });
  return result.rows[0];
}

export async function updateUserPassword(env: Env, userId: number, newPasswordHash: string): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'UPDATE users SET password = ? WHERE id = ?',
    args: [newPasswordHash, userId]
  });
  return { changes: result.rowsAffected };
}

export async function getAllStores(env: Env): Promise<any[]> {
  const client = getDatabaseClient(env);
  const result = await client.execute('SELECT * FROM stores ORDER BY id');
  return result.rows;
}

export async function createStore(env: Env, name: string): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'INSERT INTO stores (name) VALUES (?) RETURNING *',
    args: [name]
  });
  return result.rows[0];
}

export async function deleteStore(env: Env, storeId: number): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'DELETE FROM stores WHERE id = ?',
    args: [storeId]
  });
  return { changes: result.rowsAffected };
}

export async function getStoreById(env: Env, storeId: number): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'SELECT * FROM stores WHERE id = ?',
    args: [storeId]
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createOperationLog(env: Env, operationType: string, userId: number | null, storeId: number, details: string): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'INSERT INTO operation_logs (operation_type, user_id, store_id, details, operation_time) VALUES (?, ?, ?, ?, datetime("now", "+8 hours")) RETURNING *',
    args: [operationType, userId, storeId, details]
  });
  return result.rows[0];
}

export async function getOperationLogs(env: Env, storeId: number, limit: number = 50, offset: number = 0): Promise<any[]> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: `
      SELECT ol.*, u.username as user_name, ru.username as revoked_by_name
      FROM operation_logs ol
      LEFT JOIN users u ON ol.user_id = u.id
      LEFT JOIN users ru ON ol.revoked_by = ru.id
      WHERE ol.store_id = ?
      ORDER BY ol.operation_time DESC
      LIMIT ? OFFSET ?
    `,
    args: [storeId, limit, offset]
  });
  return result.rows;
}

export async function getOperationLogById(env: Env, logId: number): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'SELECT * FROM operation_logs WHERE id = ?',
    args: [logId]
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function revokeOperation(env: Env, logId: number, revokedBy: number): Promise<any> {
  const client = getDatabaseClient(env);
  const log = await getOperationLogById(env, logId);
  if (!log) {
    return { error: '操作记录不存在' };
  }
  if (log.is_revoked) {
    return { error: '该操作已被撤回' };
  }
  
  await client.execute({
    sql: 'UPDATE operation_logs SET is_revoked = 1, revoked_time = datetime("now", "+8 hours"), revoked_by = ? WHERE id = ?',
    args: [revokedBy, logId]
  });
  return { success: true, log };
}

export async function getAllUsers(env: Env): Promise<any[]> {
  const client = getDatabaseClient(env);
  const result = await client.execute('SELECT id, username, role, created_at FROM users ORDER BY id');
  return result.rows;
}

export async function createUserWithRole(env: Env, username: string, passwordHash: string, role: string = 'user'): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'INSERT INTO users (username, password, role) VALUES (?, ?, ?) RETURNING *',
    args: [username, passwordHash, role]
  });
  return result.rows[0];
}

export async function deleteUser(env: Env, userId: number): Promise<any> {
  const client = getDatabaseClient(env);
  const result = await client.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [userId]
  });
  return { changes: result.rowsAffected };
}
