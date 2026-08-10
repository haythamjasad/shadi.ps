import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { AppDataSource } from './config/database';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import publicRoutes from './routes/public.routes';
import transactionRoutes from './routes/transaction.routes';
import joinUsRoutes from './routes/joinUs.routes';

const app = express();
let databaseReady = false;
let databaseError = '';

const defaultOrigins = [
  'https://shadi.ps',
  'https://admin.shadi.ps',
  'https://store.shadi.ps',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

const allowedOrigins = Array.from(new Set([
  ...defaultOrigins,
  ...String(config.corsOrigin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
]));

const isDevelopment = config.nodeEnv === 'development';

const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const { hostname, protocol, port } = new URL(origin);
    const secureHostname = protocol === 'https:' && (hostname === 'shadi.ps' || hostname.endsWith('.shadi.ps'));
    if (secureHostname) return true;

    if (!isDevelopment) {
      return false;
    }

    const isLoopbackHost = /^(localhost|127\.0\.0\.1|::1)$/i.test(hostname);
    const isLocalDevPort = ['5173', '5174', '3000', '4173'].includes(port);

    if (protocol === 'http:' && isLocalDevPort && isLoopbackHost) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin'],
  optionsSuccessStatus: 204,
};

// Middleware
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '').trim();
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Routes
app.use('/api/v0', publicRoutes);
app.use('/api/v0/transactions', transactionRoutes);
app.use('/api/v0/join-us', joinUsRoutes);

// Health check
app.get('/api/v0/health', (req, res) => {
  res.json({
    status: 'ok',
    database: databaseReady ? 'connected' : 'disconnected',
    databaseError: databaseReady ? undefined : databaseError || undefined,
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const server = config.host
  ? app.listen(config.port, config.host, onServerListening)
  : app.listen(config.port, onServerListening);

function onServerListening() {
  console.log(`Server running on port ${config.port}`);
  console.log(`Server host: ${config.host || 'default'}`);
  console.log(`Environment: ${config.nodeEnv}`);
}

server.on('error', (error) => {
  console.error('HTTP server failed to start:', error);
});

AppDataSource.initialize()
  .then(() => {
    databaseReady = true;
    databaseError = '';
    console.log('Database connected successfully');
  })
  .catch((error) => {
    databaseReady = false;
    databaseError = error?.message || String(error || 'Database connection failed');
    console.error('Database connection failed:', error);
  });

export default app;
