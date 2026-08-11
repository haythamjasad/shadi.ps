import fs from 'fs';
import path from 'path';

function normalizePath(value) {
  const text = String(value || '').trim();
  return text ? path.resolve(text) : null;
}

function isAppRoot(candidate) {
  if (!candidate) return false;

  return fs.existsSync(path.join(candidate, 'start.cjs'))
    && fs.existsSync(path.join(candidate, 'package.json'));
}

function resolveAppRoot() {
  const envRoot = normalizePath(process.env.APP_ROOT);
  if (isAppRoot(envRoot)) return envRoot;

  const cwdRoot = normalizePath(process.cwd());
  if (isAppRoot(cwdRoot)) return cwdRoot;

  const entryFile = normalizePath(process.argv[1]);
  if (entryFile) {
    const entryRoot = path.resolve(path.dirname(entryFile), '..');
    if (isAppRoot(entryRoot)) return entryRoot;
  }

  return envRoot || cwdRoot || path.resolve(path.dirname(process.argv[1] || '.'), '..');
}

const APP_ROOT = resolveAppRoot();

export function getAppRoot() {
  return APP_ROOT;
}

export function getUploadsRoot() {
  return path.join(APP_ROOT, 'uploads');
}

export function getUploadSubdir(...parts) {
  return path.join(getUploadsRoot(), ...parts);
}
