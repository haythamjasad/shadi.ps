import dotenv from 'dotenv';

dotenv.config();

const rawEnv = (process.env.NODE_ENV || 'local').toLowerCase();
const envKey = rawEnv === 'production' || rawEnv === 'prod'
  ? 'PROD'
  : rawEnv === 'development' || rawEnv === 'local'
    ? 'LOCAL'
    : rawEnv === 'dev'
      ? 'DEV'
      : rawEnv.toUpperCase();

const pick = (base) => process.env[`${base}_${envKey}`] ?? process.env[base];
const pickBool = (base, fallback = false) => {
  const value = pick(base);
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export const config = {
  envKey,
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: pick('DB_USERNAME') ?? pick('DB_USER') ?? process.env.DB_USER,
  dbPassword: pick('DB_PASSWORD') ?? process.env.DB_PASSWORD,
  dbName: pick('DB_DATABASE') ?? pick('DB_NAME') ?? process.env.DB_NAME,
  baseUrl: pick('BASE_URL') ?? process.env.BASE_URL,
  hostApiUrl: pick('HOST_API_URL') ?? process.env.HOST_API_URL,
  lahzaApiUrl: pick('LAHZA_API_URL') ?? process.env.LAHZA_API_URL,
  lahzaSecretKey: pick('LAHZA_SECRET_KEY') ?? process.env.LAHZA_SECRET_KEY,
  lahzaWebhookSecret: pick('LAHZA_WEBHOOK_SECRET') ?? process.env.LAHZA_WEBHOOK_SECRET,
  lahzaCurrency: pick('LAHZA_CURRENCY') ?? process.env.LAHZA_CURRENCY ?? 'ILS',
  recaptchaSiteKey: pick('RECAPTCHA_SITE_KEY') ?? process.env.REACT_APP_RECAPTCHA_SITE_KEY ?? process.env.RECAPTCHA_SITE_KEY,
  recaptchaSecretKey: pick('RECAPTCHA_SECRET_KEY') ?? process.env.RECAPTCHA_SECRET_KEY,
  recaptchaVerifyUrl: pick('RECAPTCHA_VERIFY_URL') ?? process.env.RECAPTCHA_VERIFY_URL,
  recaptchaEnabled: pickBool('RECAPTCHA_ENABLED', true),
  corsOrigin: process.env.CORS_ORIGIN,
  orderNotifyEmail: pick('ORDER_NOTIFY_EMAIL') ?? process.env.ORDER_NOTIFY_EMAIL,
  apiPrefix: pick('API_PREFIX') ?? process.env.API_PREFIX,
  smtpEncryptionKey: pick('SMTP_ENCRYPTION_KEY') ?? process.env.SMTP_ENCRYPTION_KEY ?? process.env.JWT_SECRET
};
