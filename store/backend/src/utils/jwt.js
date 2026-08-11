import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret || secret === 'change-me' || secret.length < 16) {
    throw new Error('JWT_SECRET must be set to a secure value (at least 16 chars)');
  }
  return secret;
}

export function signToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || '1d') {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}
