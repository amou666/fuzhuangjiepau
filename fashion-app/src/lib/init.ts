import { db } from './db'
import { queries } from './db-queries'
import { hashPassword } from './auth'
import { config } from './config'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'

export async function ensureBaseUsers() {
  // 创建管理员
  const admin = queries.user.findByEmail(config.adminEmail)
  if (!admin) {
    const id = uuidv4()
    const passwordHash = await hashPassword(config.adminPassword)
    db.prepare(
      'INSERT INTO User (id, email, password, role, apiKey, credits) VALUES (?, ?, ?, ?, NULL, ?)'
    ).run(id, config.adminEmail, passwordHash, 'ADMIN', 9999)
    console.log(`✅ Created admin: ${config.adminEmail}`)
  }

  // 创建演示用户
  const demo = queries.user.findByEmail(config.demoEmail)
  if (!demo) {
    const id = uuidv4()
    const passwordHash = await hashPassword(config.demoPassword)
    db.prepare(
      'INSERT INTO User (id, email, password, role, apiKey, credits) VALUES (?, ?, ?, ?, NULL, ?)'
    ).run(id, config.demoEmail, passwordHash, 'CUSTOMER', 100)
    console.log(`✅ Created demo user: ${config.demoEmail}`)
  }
}

export async function ensureUploadDirectories() {
  const uploadPath = path.resolve(process.cwd(), config.uploadDir)
  const dirs = ['', 'clothing', 'models', 'scenes', 'results', 'upscaled']

  for (const dir of dirs) {
    const fullPath = path.join(uploadPath, dir)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
    }
  }

  console.log(`✅ Created upload directories at ${uploadPath}`)
}
