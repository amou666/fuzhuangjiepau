import crypto from 'crypto'

const ENC_PREFIX = 'enc:v1:'

function getSecretRaw(): string {
  const raw = (process.env.API_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || '').trim()
  if (!raw) {
    throw new Error('Missing API key encryption secret (API_KEY_ENCRYPTION_SECRET or JWT_SECRET)')
  }
  return raw
}

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(getSecretRaw()).digest()
}

function getDeterministicIv(plaintext: string): Buffer {
  const secret = getSecretRaw()
  // 为了兼容现有唯一索引，采用确定性 IV（同一明文得到同一密文）
  // 这样可继续通过数据库唯一约束防止重复 API Key
  return crypto
    .createHash('sha256')
    .update(`api-key-iv:${secret}:${plaintext}`)
    .digest()
    .subarray(0, 12)
}

export function isEncryptedApiKey(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(ENC_PREFIX))
}

export function encryptApiKey(apiKey: string): string {
  const plaintext = apiKey.trim()
  if (!plaintext) return plaintext
  if (isEncryptedApiKey(plaintext)) return plaintext

  const key = getEncryptionKey()
  const iv = getDeterministicIv(plaintext)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64')
  return `${ENC_PREFIX}${payload}`
}

export function decryptApiKey(value: string | null | undefined): string {
  if (!value) return ''
  const raw = value.trim()
  if (!isEncryptedApiKey(raw)) return raw

  const payload = Buffer.from(raw.slice(ENC_PREFIX.length), 'base64')
  const iv = payload.subarray(0, 12)
  const tag = payload.subarray(12, 28)
  const encrypted = payload.subarray(28)

  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function maskApiKey(apiKey: string | null | undefined): string {
  const plain = decryptApiKey(apiKey)
  if (!plain) return '-'
  const normalized = plain.trim()
  if (normalized.length <= 8) return '****'
  return `${normalized.slice(0, 4)}${'*'.repeat(Math.max(4, normalized.length - 8))}${normalized.slice(-4)}`
}
