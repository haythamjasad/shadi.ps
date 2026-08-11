import dotenv from 'dotenv';
import path from 'path';

// cPanel commonly stores production variables in `.env`; load it first, then
// allow `.env.prod` to override when it exists.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.prod'), override: true });
}

const nodeEnv = process.env.NODE_ENV || 'development';
const port = parseInt(process.env.PORT || '5010', 10);
const isProduction = nodeEnv === 'production';

const getEnv = (name: string, fallback = ''): string => {
  const value = process.env[name]?.trim();
  return value !== undefined && value !== '' ? value : fallback;
};

const getAnyEnv = (names: string[], fallback = ''): string => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value !== undefined && value !== '') return value;
  }
  return fallback;
};

const jwtSecret = getAnyEnv(
  ['JWT_SECRET', 'JWT_SECRET_LOCAL', 'PASSWORD_RESET_SECRET', 'PASSWORD_RESET_SECRET_LOCAL'],
  'temporary-cpanel-startup-secret-change-me'
);
if (jwtSecret === 'temporary-cpanel-startup-secret-change-me') {
  console.warn('JWT_SECRET is not configured. Set JWT_SECRET in cPanel environment for production.');
}

const host = getEnv('HOST', '');

export const config = {
  nodeEnv,
  port,
  host,

  // Database
  db: {
    host: getAnyEnv(['DB_HOST', 'MYSQL_HOST'], 'localhost'),
    port: parseInt(getAnyEnv(['DB_PORT', 'MYSQL_PORT'], '3306'), 10),
    username: getAnyEnv(['DB_USERNAME', 'DB_USER', 'MYSQL_USER'], 'root'),
    password: getAnyEnv(['DB_PASSWORD', 'MYSQL_PASSWORD'], ''),
    database: getAnyEnv(['DB_DATABASE', 'DB_NAME', 'MYSQL_DATABASE'], 'shadi_ps'),
  },

  // JWT
  jwt: {
    secret: jwtSecret,
    expiresIn: getEnv('JWT_EXPIRES_IN', '12h'),
  },

  // Email
  smtp: {
    host: getEnv('SMTP_HOST', 'localhost'),
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: getEnv('SMTP_FROM', 'Shadi PS <noreply@localhost>'),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  corsOrigin: getEnv(
    'CORS_ORIGIN',
    isProduction ? 'https://shadi.ps,https://admin.shadi.ps,https://store.shadi.ps' : 'http://localhost:5173'
  ),

  // Lahza API Key
  lahzaSecretKey: process.env.LAHZA_SECRET_KEY || '',
  lahzaApiUrl: getEnv('LAHZA_API_URL', 'https://api.lahza.io/transaction'),

  hostApiUrl: getEnv('HOST_API_URL', isProduction ? 'https://shadi.ps/api/v0' : `http://localhost:${port}/api/v0`),
  baseUrl: getEnv('BASE_URL', isProduction ? 'https://shadi.ps' : 'http://localhost:5173'),
};
