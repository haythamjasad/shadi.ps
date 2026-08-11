import mysql from 'mysql2/promise';
import { config } from './config/env.js';

const pool = mysql.createPool({
  host: config.dbHost,
  user: config.dbUser,
  password: config.dbPassword,
  database: config.dbName,
  port: config.dbPort,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
