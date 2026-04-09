import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { config } from './config'

export interface JwtPayload {
  userId: string
  email: string
  role: string
}

export const createAccessToken = (payload: JwtPayload) => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '2h' })
}

export const createRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, config.jwtRefreshSecret, { expiresIn: '7d' })
}

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload
}

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, config.jwtRefreshSecret) as { userId: string }
}

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10)
}

export const comparePassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash)
}

export const extractTokenFromHeader = (authHeader: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}
