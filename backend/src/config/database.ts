import { DataSource } from 'typeorm';
import { config } from './env';
import { User } from '../entities/User';
import { Transaction } from '../entities/Transaction';
import { JoinUs } from '../entities/JoinUs';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  synchronize: config.nodeEnv === 'development', // Auto-sync in dev only
  logging: config.nodeEnv === 'development',
  entities: [User, Transaction, JoinUs],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
  timezone: 'Z', // UTC
});
