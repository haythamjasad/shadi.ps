import { User } from '../entities/User';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        roles: string[];
      };
      adminSession?: {
        id: string;
        email: string;
        source: 'legacy' | 'trusted';
        isSuperAdmin: boolean;
        permissions: Record<string, Record<string, boolean>>;
      };
    }
  }
}

export {};
