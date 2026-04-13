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

    const isLoopbackHost = /^(localhost|127\.0\.0\.1|::1)$/i.test(hostname);
    const isPrivateIpv4Host = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(hostname);
    const isLocalDevPort = ['5173', '5174', '3000', '4173'].includes(port);

    if (protocol === 'http:' && isLocalDevPort && (isLoopbackHost || isPrivateIpv4Host)) {
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
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v0', publicRoutes);
app.use('/api/v0/transactions', transactionRoutes);
app.use('/api/v0/join-us', joinUsRoutes);

// Health check
app.get('/api/v0/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
AppDataSource.initialize()
  .then(() => {
    console.log('Database connected successfully');
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });

export default app;
