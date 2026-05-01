import Database from 'better-sqlite3'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

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
    fontSize INTEGER NOT NULL DEFAULT 14,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS SystemConfig (
    id TEXT PRIMARY KEY DEFAULT 'global',
    aiModel TEXT NOT NULL DEFAULT '',
    analysisModel TEXT NOT NULL DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS PosePreset (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'daily',
    label TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    thumbnailUrl TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
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
try { db.exec('CREATE INDEX IF NOT EXISTS idx_pose_preset_category_sort ON PosePreset(category, sortOrder)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_pose_preset_active ON PosePreset(isActive)') } catch {}

// ─── 姿势预设种子数据（仅首次运行时插入） ───
try {
  const count = (db.prepare('SELECT COUNT(*) as c FROM PosePreset').get() as any).c
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO PosePreset (id, category, label, prompt, sortOrder, isActive) VALUES (?, ?, ?, ?, ?, 1)'
    )
    const seed: Array<[string, string, string, string, number]> = [
      // 日常
      [uuidv4(), 'daily', '正面站姿', 'standing facing the camera directly, confident posture, arms relaxed at sides, weight evenly distributed', 1],
      [uuidv4(), 'daily', '侧面站姿', 'standing in side profile, body turned 90 degrees from camera, looking straight ahead, elegant silhouette', 2],
      [uuidv4(), 'daily', '背面展示', 'standing with back to the camera, showing the back of the garment, slight head turn to one side', 3],
      [uuidv4(), 'daily', '行走动态', 'mid-stride walking pose, one foot forward, natural arm swing, dynamic movement, hair caught in gentle motion', 4],
      [uuidv4(), 'daily', '叉腰自信', 'standing with hands on hips, confident powerful pose, shoulders back, chin slightly raised', 5],
      [uuidv4(), 'daily', '回眸', 'standing with back partially turned, looking back over shoulder toward camera, subtle expression', 6],
      [uuidv4(), 'daily', '坐姿', 'seated elegantly, legs crossed, composed relaxed posture, one hand resting on knee', 7],
      [uuidv4(), 'daily', '自然抓拍', 'natural candid moment, slight smile, one hand adjusting clothing, relaxed unposed feeling', 8],
      // 海边
      [uuidv4(), 'beach', '海风吹拂', 'standing on sand facing ocean breeze, hair blowing gracefully in the wind, eyes half-closed enjoying the breeze, arms slightly open', 1],
      [uuidv4(), 'beach', '踏浪行走', 'walking barefoot along the shoreline, waves lapping at ankles, carefree stride, looking down at the water', 2],
      [uuidv4(), 'beach', '仰望阳光', 'standing on beach, face tilted up toward the sun, eyes gently closed, arms relaxed, basking in warm light', 3],
      [uuidv4(), 'beach', '弯腰拾贝', 'bending down to pick up a shell from the sand, one foot slightly raised behind, hair falling forward naturally', 4],
      [uuidv4(), 'beach', '坐看海景', 'sitting on sand dune, knees drawn up, arms wrapped loosely around knees, gazing at the horizon', 5],
      [uuidv4(), 'beach', '旋转裙摆', 'mid-twirl on the beach, garment spinning outward, arms extended, joyful expression, sand beneath feet', 6],
      [uuidv4(), 'beach', '背对大海', 'standing with back to the ocean, looking over shoulder at camera, waves visible behind, sunset glow', 7],
      [uuidv4(), 'beach', '展臂深呼吸', 'standing at the water edge, arms stretched wide open to the sea, deep breath, chest lifted, liberating pose', 8],
      // 街拍
      [uuidv4(), 'street', '靠墙慵懒', 'leaning casually against a brick or concrete wall, one shoulder resting, relaxed chic attitude, ankles crossed', 1],
      [uuidv4(), 'street', '力量站姿', 'wide stance on city sidewalk, one hand in pocket, other arm relaxed, commanding presence, strong silhouette', 2],
      [uuidv4(), 'street', '斑马线过街', 'mid-stride crossing a street, confident walk, one foot on crosswalk line, urban backdrop, slight motion blur suggestion', 3],
      [uuidv4(), 'street', '外套甩动', 'walking forward while swinging a coat or jacket off one shoulder, dynamic fabric movement, confident stride', 4],
      [uuidv4(), 'street', '咖啡馆门口', 'standing in a cafe doorway, one hand on door frame, half-inside half-outside, casual urban moment', 5],
      [uuidv4(), 'street', '调整墨镜', 'adjusting sunglasses with one hand, chin slightly raised, cool detached expression, street style attitude', 6],
      [uuidv4(), 'street', '低头看手机', 'walking while looking at phone, one hand holding phone near face, other hand in pocket, natural urban behavior', 7],
      [uuidv4(), 'street', '橱窗驻足', 'pausing in front of a shop window, body angled toward window, hand lightly touching glass, reflected lights', 8],
      // 棚拍
      [uuidv4(), 'studio', '3/4 侧身', 'classic three-quarter turn pose in studio, body angled 45 degrees, face toward camera, one hand on waist, clean background', 1],
      [uuidv4(), 'studio', 'S 曲线', 'standing in elegant S-curve posture, weight on one hip, shoulders tilted opposite direction, studio lighting, model pose', 2],
      [uuidv4(), 'studio', '手触脸颊', 'one hand delicately touching cheek, fingers near temple, soft expression, studio lighting, beauty pose', 3],
      [uuidv4(), 'studio', '双手交叉', 'standing with arms crossed over chest, confident editorial look, chin slightly up, studio backdrop', 4],
      [uuidv4(), 'studio', '回肩望', 'facing away from camera, turning head to look over one shoulder, back of garment visible, studio lighting highlighting shoulders', 5],
      [uuidv4(), 'studio', '高脚凳坐姿', 'seated on a tall studio stool, one leg extended, other bent, leaning forward slightly, editorial attitude', 6],
      [uuidv4(), 'studio', '插兜前倾', 'both hands in pockets, leaning slightly forward toward camera, intense direct gaze, editorial fashion shot', 7],
      [uuidv4(), 'studio', '半脱外套', 'jacket slipping off one shoulder, one hand holding the other sleeve, sensual editorial pose, studio backdrop', 8],
    ]
    db.transaction(() => { for (const row of seed) insert.run(...row) })()
  }
} catch (err) {
  console.error('[PosePreset Seed Error]', err)
}

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
try {
  db.exec(`ALTER TABLE SystemConfig ADD COLUMN analysisModel TEXT NOT NULL DEFAULT ''`)
} catch {}
// 迁移：将空字符串 apiKey 改为 NULL，避免 UNIQUE 约束冲突
try {
  db.exec(`UPDATE User SET apiKey = NULL WHERE apiKey = ''`)
} catch {}
