import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const nodeEnv = process.env.NODE_ENV || 'development';
const port = parseInt(process.env.PORT || '3000', 10);

const getEnv = (name: string, fallback = ''): string => {
  const value = process.env[name]?.trim();
  return value !== undefined && value !== '' ? value : fallback;
};

export const config = {
  nodeEnv,
  port,

  // Database
  db: {
    host: getEnv('DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: getEnv('DB_USERNAME', 'root'),
    password: process.env.DB_PASSWORD || '',
    database: getEnv('DB_DATABASE', 'shadi_ps'),
  },

  // JWT
  jwt: {
    secret: getEnv('JWT_SECRET', 'dev-only-jwt-secret'),
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
  corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:5173'),

  // Lahza API Key
  lahzaSecretKey: process.env.LAHZA_SECRET_KEY || '',
  lahzaApiUrl: getEnv('LAHZA_API_URL', 'https://api.lahza.io/transaction'),

  hostApiUrl: getEnv('HOST_API_URL', `http://localhost:${port}/api/v0`),
  baseUrl: getEnv('BASE_URL', 'http://localhost:5173'),
};
