import { Database } from 'bun:sqlite';

// 创建数据库连接
export const db = new Database('inventory.db');

// 初始化表结构
export function initDatabase() {
  // 创建店铺表
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 创建食材表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '个',
      store_id INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );
  `);

  // 创建菜品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      store_id INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );
  `);

  // 创建菜品与食材关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dish_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dish_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (dish_id) REFERENCES dishes(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  // 创建用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 创建操作记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      store_id INTEGER NOT NULL,
      details TEXT NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      revoked_time TIMESTAMP,
      revoked_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );
  `);

  // 创建默认店铺
  const defaultStoreExists = db.prepare('SELECT * FROM stores WHERE id = 1').get();
  if (!defaultStoreExists) {
    db.prepare('INSERT INTO stores (id, name) VALUES (1, ?)').run('默认店铺');
  }

  // 迁移现有数据：为没有 store_id 的食材和菜品设置默认店铺
  try {
    db.exec(`
      UPDATE ingredients SET store_id = 1 WHERE store_id IS NULL OR store_id = 0;
      UPDATE dishes SET store_id = 1 WHERE store_id IS NULL OR store_id = 0;
    `);
  } catch (e) {
    console.log('数据迁移完成或无需迁移');
  }

  // 迁移用户数据：为没有 role 的用户设置默认角色
  try {
    db.exec(`
      UPDATE users SET role = 'admin' WHERE username = 'admin' AND role IS NULL;
      UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';
    `);
  } catch (e) {
    console.log('用户角色迁移完成或无需迁移');
  }
}

// 用户注册
export function createUser(username: string, passwordHash: string): any {
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, passwordHash);
  return { id: result.lastInsertRowid, username };
}

// 根据用户名获取用户
export function getUserByUsername(username: string): any {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

// 根据用户ID获取用户
export function getUserById(id: number): any {
  return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
}

// 根据用户ID获取用户（包括密码）
export function getUserByIdWithPassword(id: number): any {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// 创建默认管理员用户
export function createDefaultAdminUser(passwordHash: string): any {
  const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', passwordHash, 'admin');
  return { id: result.lastInsertRowid, username: 'admin', role: 'admin' };
}

// 检查是否存在管理员用户
export function adminUserExists(): any {
  return db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
}

// 更新用户密码
export function updateUserPassword(userId: number, newPasswordHash: string): any {
  const result = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPasswordHash, userId);
  return { changes: result.changes };
}

// 店铺管理函数
export function getAllStores(): any {
  return db.prepare('SELECT * FROM stores ORDER BY id').all();
}

export function createStore(name: string): any {
  const result = db.prepare('INSERT INTO stores (name) VALUES (?)').run(name);
  return { id: result.lastInsertRowid, name };
}

export function deleteStore(storeId: number): any {
  const result = db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
  return { changes: result.changes };
}

export function getStoreById(storeId: number): any {
  return db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
}

export function createOperationLog(operationType: string, userId: number | null, storeId: number, details: string): any {
  const result = db.prepare('INSERT INTO operation_logs (operation_type, user_id, store_id, details) VALUES (?, ?, ?, ?)').run(operationType, userId, storeId, details);
  return { id: result.lastInsertRowid };
}

export function getOperationLogs(storeId: number, limit: number = 50, offset: number = 0): any {
  return db.prepare(`
    SELECT ol.*, u.username as user_name, ru.username as revoked_by_name
    FROM operation_logs ol
    LEFT JOIN users u ON ol.user_id = u.id
    LEFT JOIN users ru ON ol.revoked_by = ru.id
    WHERE ol.store_id = ?
    ORDER BY ol.operation_time DESC
    LIMIT ? OFFSET ?
  `).all(storeId, limit, offset);
}

export function getOperationLogById(logId: number): any {
  return db.prepare('SELECT * FROM operation_logs WHERE id = ?').get(logId);
}

export function revokeOperation(logId: number, revokedBy: number): any {
  const log = getOperationLogById(logId);
  if (!log) {
    return { error: '操作记录不存在' };
  }
  if (log.is_revoked) {
    return { error: '该操作已被撤回' };
  }
  
  const revokedTime = new Date().toISOString();
  db.prepare('UPDATE operation_logs SET is_revoked = 1, revoked_time = ?, revoked_by = ? WHERE id = ?').run(revokedTime, revokedBy, logId);
  return { success: true, log };
}

// 用户管理函数
export function getAllUsers(): any {
  return db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
}

export function createUserWithRole(username: string, passwordHash: string, role: string = 'user'): any {
  const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, passwordHash, role);
  return { id: result.lastInsertRowid, username, role };
}

export function deleteUser(userId: number): any {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return { changes: result.changes };
}