import { Database } from 'bun:sqlite';

// 创建数据库连接
export const db = new Database('inventory.db');

// 初始化表结构
export function initDatabase() {
  // 创建食材表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '个',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 创建菜品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
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
  return db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(id);
}

// 根据用户ID获取用户（包括密码）
export function getUserByIdWithPassword(id: number): any {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// 创建默认管理员用户
export function createDefaultAdminUser(passwordHash: string): any {
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', passwordHash);
  return { id: result.lastInsertRowid, username: 'admin' };
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