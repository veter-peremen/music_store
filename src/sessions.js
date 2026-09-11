const { randomBytes, createHash } = require('node:crypto');

const db = require('./db');
const config = require('./config');
const { serializeCookie } = require('./utils/cookies');

const COOKIE_NAME = 'session';
const TTL_SECONDS = 7 * 24 * 60 * 60;

/** В базе лежит отпечаток токена, а не он сам — дамп базы не даёт войти. */
const fingerprint = (token) => createHash('sha256').update(token).digest('hex');

async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);

  await db('sessions').insert({
    token_hash: fingerprint(token),
    user_id: userId,
    expires_at: expiresAt,
  });

  return token;
}

/** Возвращает пользователя по токену либо null, если сессии нет или истекла. */
async function findSessionUser(token) {
  if (!token) return null;

  const session = await db('sessions')
    .where({ token_hash: fingerprint(token) })
    .first();
  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    await db('sessions').where({ token_hash: session.token_hash }).del();
    return null;
  }

  const user = await db('users').where({ id: session.user_id }).first();
  return user || null;
}

async function destroySession(token) {
  if (!token) return;
  await db('sessions')
    .where({ token_hash: fingerprint(token) })
    .del();
}

const sessionCookie = (token) =>
  serializeCookie(COOKIE_NAME, token, {
    maxAge: TTL_SECONDS,
    secure: config.env === 'production',
  });

const clearedCookie = () =>
  serializeCookie(COOKIE_NAME, '', { maxAge: 0, secure: config.env === 'production' });

module.exports = {
  COOKIE_NAME,
  createSession,
  findSessionUser,
  destroySession,
  sessionCookie,
  clearedCookie,
};
