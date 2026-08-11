import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const workspaceRoot = '/home/haytham/Desktop/shadi-ps-github';
const backendRoot = path.join(workspaceRoot, 'store/backend');
const envPath = path.join(backendRoot, '.env');
const backupPath = process.argv[2] || '/home/haytham/.codex/attachments/b44f09fc-f635-4873-b1b2-0d2df9028a19/shadictu_Store_Shadi_Prod.sql';
const outputPath = process.argv[3] || path.join(workspaceRoot, 'exports/products-from-production-backup.sql');

function parseEnv(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio || 'pipe',
    encoding: options.encoding || 'utf8',
    input: options.input,
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed\n${result.stderr || result.stdout}`);
  }
  return result;
}

function runToFile(command, args, outputFile) {
  const fd = fs.openSync(outputFile, 'w');
  try {
    const result = spawnSync(command, args, {
      stdio: ['ignore', fd, 'pipe'],
      encoding: 'utf8',
      env: process.env
    });
    if (result.status !== 0) {
      throw new Error(`${command} failed\n${result.stderr || ''}`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function writeMysqlDefaults(env) {
  const filePath = path.join(os.tmpdir(), `shadi-mysql-${Date.now()}.cnf`);
  const dbUser = env.DB_USERNAME || env.DB_USER;
  const dbPassword = env.DB_PASSWORD || '';
  const dbHost = env.DB_HOST || 'localhost';
  const dbPort = env.DB_PORT || '3306';
  fs.writeFileSync(
    filePath,
    [
      '[client]',
      `user=${dbUser}`,
      `password=${dbPassword}`,
      `host=${dbHost}`,
      `port=${dbPort}`,
      'default-character-set=utf8mb4',
      ''
    ].join('\n'),
    { mode: 0o600 }
  );
  return filePath;
}

function stripCreateAndDrop(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => {
      if (/^DROP TABLE IF EXISTS `products`/i.test(line)) return false;
      if (/^CREATE TABLE `products`/i.test(line)) return false;
      if (/^\).*ENGINE=/i.test(line)) return false;
      return true;
    })
    .join('\n');
}

const env = parseEnv(envPath);
const dbName = `restore_products_${Date.now()}`;
const defaultsFile = writeMysqlDefaults(env);

try {
  if (!fs.existsSync(backupPath)) throw new Error(`Backup not found: ${backupPath}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  run('mysql', [`--defaults-extra-file=${defaultsFile}`, '-e', `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`]);
  run('mysql', [`--defaults-extra-file=${defaultsFile}`, dbName], {
    input: fs.readFileSync(backupPath),
    encoding: 'buffer'
  });

  const rawDumpPath = path.join(os.tmpdir(), `products-dump-${Date.now()}.sql`);
  runToFile('mysqldump', [
    `--defaults-extra-file=${defaultsFile}`,
    '--skip-comments',
    '--skip-add-drop-table',
    '--no-create-info',
    '--complete-insert',
    '--single-transaction',
    dbName,
    'products'
  ], rawDumpPath);

  const dump = fs.readFileSync(rawDumpPath, 'utf8');
  fs.rmSync(rawDumpPath, { force: true });

  const wrapped = [
    '-- Products data restored from production backup.',
    '-- Import this file into cPanel/phpMyAdmin to replace current product rows only.',
    '-- It does not DROP or CREATE the products table, so newer schema columns remain intact.',
    'SET FOREIGN_KEY_CHECKS=0;',
    'DELETE FROM `products`;',
    stripCreateAndDrop(dump).trim(),
    'SET FOREIGN_KEY_CHECKS=1;',
    ''
  ].join('\n');

  fs.writeFileSync(outputPath, wrapped, 'utf8');

  const count = run('mysql', [
    `--defaults-extra-file=${defaultsFile}`,
    '-N',
    '-B',
    '-e',
    `SELECT COUNT(*) FROM \`${dbName}\`.products;`
  ]).stdout.trim();

  console.log(JSON.stringify({ dbName, outputPath, products: Number(count), bytes: fs.statSync(outputPath).size }, null, 2));
} finally {
  try {
    run('mysql', [`--defaults-extra-file=${defaultsFile}`, '-e', `DROP DATABASE IF EXISTS \`${dbName}\`;`]);
  } catch {
    // If cleanup fails, keep going so the export result is still visible.
  }
  fs.rmSync(defaultsFile, { force: true });
}
