import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtUser, Role } from '../types';

export const createAccessToken = (payload: JwtUser) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: '2h' });

export const createRefreshToken = (userId: string) =>
  jwt.sign({ userId }, config.jwtRefreshSecret, { expiresIn: '7d' });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, config.jwtSecret) as JwtUser;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, config.jwtRefreshSecret) as { userId: string };

export const toJwtUser = (user: { id: string; email: string; role: Role }): JwtUser => ({
  userId: user.id,
  email: user.email,
  role: user.role,
});
