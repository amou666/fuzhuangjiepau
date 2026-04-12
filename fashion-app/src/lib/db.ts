import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.resolve(process.cwd(), 'data', 'fashion.db')

const db = new Database(DB_PATH)

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CUSTOMER',
    apiKey TEXT DEFAULT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS GenerationTask (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    creditCost INTEGER NOT NULL DEFAULT 0,
    clothingUrl TEXT NOT NULL DEFAULT '',
    clothingBackUrl TEXT DEFAULT '',
    clothingDetailUrls TEXT DEFAULT '[]',
    clothingDescription TEXT,
    modelConfig TEXT NOT NULL DEFAULT '{}',
    sceneConfig TEXT NOT NULL DEFAULT '{}',
    resultUrl TEXT,
    upscaledUrl TEXT,
    upscaleFactor INTEGER,
    errorMsg TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    finishedAt TEXT,
    FOREIGN KEY (userId) REFERENCES User(id)
  );

  CREATE TABLE IF NOT EXISTS CreditLog (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    delta INTEGER NOT NULL,
    balanceAfter INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES User(id)
  );

  CREATE TABLE IF NOT EXISTS AdminAuditLog (
    id TEXT PRIMARY KEY,
    adminId TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT '',
    targetUserId TEXT,
    detail TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (adminId) REFERENCES User(id)
  );

  CREATE TABLE IF NOT EXISTS ClothingCache (
    imageUrl TEXT PRIMARY KEY,
    materialDesc TEXT,
    materialDna TEXT,
    category TEXT,
    silhouette TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

export { db }

// 数据库迁移：为已有表添加新列
try {
  db.exec(`ALTER TABLE GenerationTask ADD COLUMN clothingBackUrl TEXT DEFAULT ''`)
} catch {}
try {
  db.exec(`ALTER TABLE GenerationTask ADD COLUMN clothingDetailUrls TEXT DEFAULT '[]'`)
} catch {}
try {
  db.exec(`ALTER TABLE GenerationTask ADD COLUMN type TEXT NOT NULL DEFAULT 'workspace'`)
} catch {}
try {
  db.exec(`ALTER TABLE GenerationTask ADD COLUMN resultUrls TEXT DEFAULT '[]'`)
} catch {}
// 迁移：将空字符串 apiKey 改为 NULL，避免 UNIQUE 约束冲突
try {
  db.exec(`UPDATE User SET apiKey = NULL WHERE apiKey = ''`)
} catch {}
