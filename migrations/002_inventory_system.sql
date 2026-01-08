-- Database migration for Inventory Management System
-- This migration creates all tables for the inventory management system

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '个',
  store_id INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Create dishes table
CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  store_id INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Create dish_ingredients table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS dish_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (dish_id) REFERENCES dishes(id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create operation_logs table
CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,
  operation_time TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER,
  store_id INTEGER NOT NULL,
  details TEXT NOT NULL,
  is_revoked INTEGER DEFAULT 0,
  revoked_time TEXT,
  revoked_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (revoked_by) REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ingredients_store_id ON ingredients(store_id);
CREATE INDEX IF NOT EXISTS idx_dishes_store_id ON dishes(store_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish_id ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient_id ON dish_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_store_id ON operation_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_time ON operation_logs(operation_time);

-- Insert default store
INSERT OR IGNORE INTO stores (id, name) VALUES (1, '默认店铺');
