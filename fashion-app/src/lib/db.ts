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

  CREATE TABLE IF NOT EXISTS Notification (
    id TEXT PRIMARY KEY,
    userId TEXT,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    isRead INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES User(id)
  );

  CREATE TABLE IF NOT EXISTS TaskFeedback (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    userId TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 0,
    comment TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (taskId) REFERENCES GenerationTask(id),
    FOREIGN KEY (userId) REFERENCES User(id)
  );

  CREATE TABLE IF NOT EXISTS WatermarkConfig (
    id TEXT PRIMARY KEY DEFAULT 'global',
    enabled INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT 'bottom-right',
    opacity REAL NOT NULL DEFAULT 0.3,
    fontSize INTEGER NOT NULL DEFAULT 16,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS Template (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    previewUrl TEXT,
    clothingUrl TEXT,
    modelConfig TEXT NOT NULL DEFAULT '{}',
    sceneConfig TEXT NOT NULL DEFAULT '{}',
    isActive INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS Favorite (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    previewUrl TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES User(id)
  );
`)

export { db }

// ─── 索引 ───
try { db.exec('CREATE INDEX IF NOT EXISTS idx_generation_task_user_created ON GenerationTask(userId, createdAt DESC)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_generation_task_status ON GenerationTask(status)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_credit_log_user_created ON CreditLog(userId, createdAt DESC)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_notification_user_read ON Notification(userId, isRead, createdAt DESC)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_favorite_user_type ON Favorite(userId, type, createdAt DESC)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_created ON AdminAuditLog(createdAt DESC)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_template_active_sort ON Template(isActive, sortOrder)') } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_task_user ON TaskFeedback(taskId, userId)') } catch {}

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
