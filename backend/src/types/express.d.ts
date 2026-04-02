import type { JwtUser } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export {};
