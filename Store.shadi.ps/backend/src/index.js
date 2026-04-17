import express from 'express';
import cors from 'cors';
import path from 'path';
import adminRoutes from './routes/admin.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import settingsRoutes from './routes/settings.js';
import { runMigrations } from './bootstrap/run-migrations.js';
import { config } from './config/env.js';
import { getUploadSubdir, getUploadsRoot } from './utils/app-paths.js';

const app = express();

const defaultOrigins = [
  'https://store.shadi.ps',
  'https://admin.shadi.ps',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://[::1]:3000',
  'http://[::1]:4173',
  'http://[::1]:5173',
  'http://[::1]:5174'
];

const configuredOrigins = (config.corsOrigin || config.baseUrl || defaultOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([
  ...defaultOrigins,
  ...configuredOrigins
]));

function isAllowedOrigin(origin) {
  const value = String(origin || '').trim();
  if (!value) return true;
  if (allowedOrigins.includes(value)) return true;

  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && /(^|\.)shadi\.ps$/i.test(url.hostname)) {
      return true;
    }

    const isLoopbackHost = /^(localhost|127\.0\.0\.1|::1)$/i.test(url.hostname);
    const isPrivateIpv4Host = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(url.hostname);
    const isLocalDevPort = ['3000', '4173', '5173', '5174'].includes(url.port);

    if (url.protocol === 'http:' && isLocalDevPort && (isLoopbackHost || isPrivateIpv4Host)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: false,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Checkout-Token'],
  optionsSuccessStatus: 204
};

app.use((req, res, next) => {
  const origin = String(req.headers.origin || '').trim();
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Checkout-Token');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({
  limit: '20mb',
  verify: (req, _res, buffer) => {
    req.rawBody = buffer.toString('utf8');
  }
}));

const normalizedPrefix = (config.apiPrefix || '').trim();
const prefixes = new Set(['', '/api', '/api/v01', '/v01']);
if (normalizedPrefix) {
  prefixes.add(normalizedPrefix.startsWith('/') ? normalizedPrefix : `/${normalizedPrefix}`);
}

app.use('/assets', express.static(getUploadSubdir('docs')));

for (const prefix of prefixes) {
  const p = prefix === '/' ? '' : prefix.replace(/\/+$/, '');
  app.get(`${p}/health`, (req, res) => res.json({ ok: true }));
  app.use(`${p}/assets`, express.static(getUploadSubdir('docs')));
  app.use(`${p}/uploads`, express.static(getUploadsRoot()));
  app.use(`${p}/admin`, adminRoutes);
  app.use(`${p}/products`, productRoutes);
  app.use(`${p}/orders`, orderRoutes);
  app.use(`${p}/payments`, paymentRoutes);
  app.use(`${p}/settings`, settingsRoutes);
}

app.use((req, res) => {
  if (req.accepts('html')) {
    return res.redirect(302, '/');
  }
  return res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

const port = process.env.PORT || 4000;

async function startServer() {
  await runMigrations();
  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start backend', err);
  process.exit(1);
});
