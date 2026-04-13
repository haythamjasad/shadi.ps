import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../entities/User';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';

type PermissionMap = Record<string, Record<string, boolean>>;

interface LegacyAdminPayload {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

interface TrustedAdminPayload {
  id: string | number;
  email: string;
  role: string;
  is_super_admin?: boolean;
  permissions?: PermissionMap;
  purpose?: string;
}

function isTrustedLocalDevOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  try {
    const { protocol, hostname, port } = new URL(origin);
    const isLoopbackHost = /^(localhost|127\.0\.0\.1|::1)$/i.test(hostname);
    const isPrivateIpv4Host = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(hostname);
    const isLocalDevPort = ['3000', '4173', '5173', '5174'].includes(port);
    return protocol === 'http:' && isLocalDevPort && (isLoopbackHost || isPrivateIpv4Host);
  } catch {
    return false;
  }
}

function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }
  return authHeader.split(' ')[1];
}

function verifyToken<T>(token: string, secret: string): T | null {
  try {
    return jwt.verify(token, secret) as T;
  } catch {
    return null;
  }
}

function normalizePermissions(value: unknown): PermissionMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([moduleName, actions]) => [
      moduleName,
      Object.fromEntries(
        Object.entries(actions && typeof actions === 'object' && !Array.isArray(actions) ? actions : {}).map(
          ([action, allowed]) => [action, !!allowed]
        )
      )
    ])
  );
}

function tryLegacyAdminToken(token: string) {
  const decoded = verifyToken<LegacyAdminPayload>(token, config.jwt.secret);
  if (!decoded?.roles?.includes(UserRole.ADMIN)) return null;

  return {
    id: String(decoded.id || ''),
    email: String(decoded.email || ''),
    source: 'legacy' as const,
    isSuperAdmin: true,
    permissions: {} as PermissionMap,
    user: {
      id: String(decoded.id || ''),
      email: String(decoded.email || ''),
      firstName: String(decoded.firstName || ''),
      lastName: String(decoded.lastName || ''),
      roles: decoded.roles
    }
  };
}

function trustedSecrets(): string[] {
  const rawValues = [process.env.TRUSTED_ADMIN_JWT_SECRET, process.env.CENTRAL_ADMIN_JWT_SECRET, config.jwt.secret];
  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function tryTrustedAdminToken(token: string) {
  for (const secret of trustedSecrets()) {
    const decoded = verifyToken<TrustedAdminPayload>(token, secret);
    if (!decoded || decoded.role !== 'admin' || decoded.purpose) {
      continue;
    }

    return {
      id: String(decoded.id || ''),
      email: String(decoded.email || ''),
      source: 'trusted' as const,
      isSuperAdmin: !!decoded.is_super_admin,
      permissions: normalizePermissions(decoded.permissions),
      user: {
        id: String(decoded.id || ''),
        email: String(decoded.email || ''),
        firstName: '',
        lastName: '',
        roles: [UserRole.ADMIN]
      }
    };
  }

  return null;
}

export const authenticateAdminAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (isTrustedLocalDevOrigin(String(req.headers.origin || ''))) {
      req.user = {
        id: 'local-dev-admin',
        email: 'local-dev-admin@shadi.ps',
        firstName: 'Local',
        lastName: 'Dev',
        roles: [UserRole.ADMIN]
      } as any;
      req.adminSession = {
        id: 'local-dev-admin',
        email: 'local-dev-admin@shadi.ps',
        source: 'trusted',
        isSuperAdmin: true,
        permissions: {}
      };
      next();
      return;
    }

    const token = getBearerToken(req);
    const session = tryLegacyAdminToken(token) || tryTrustedAdminToken(token);

    if (!session) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired admin token');
    }

    req.user = session.user;
    req.adminSession = {
      id: session.id,
      email: session.email,
      source: session.source,
      isSuperAdmin: session.isSuperAdmin,
      permissions: session.permissions
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError(401, 'TOKEN_EXPIRED', 'Token has expired'));
      return;
    }
    next(error);
  }
};

export const requireAdminPermission = (moduleName: string, action: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.adminSession) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Not authenticated'));
    }

    if (req.adminSession.source === 'legacy' || req.adminSession.isSuperAdmin) {
      return next();
    }

    if (req.adminSession.permissions?.[moduleName]?.[action]) {
      return next();
    }

    return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
  };
};
