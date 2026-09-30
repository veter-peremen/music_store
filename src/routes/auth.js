const express = require('express');

const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { hashPassword, verifyPassword } = require('../domain/password');
const { DEFAULT_ROLE } = require('../domain/roles');
const { ConflictError, UnauthorizedError } = require('../errors');
const { parse, credentials } = require('../validation/schemas');
const { createSession, destroySession, sessionCookie, clearedCookie } = require('../sessions');

const router = express.Router();

/** Наружу отдаём только безобидные поля: хеш пароля остаётся в базе. */
const publicUser = (user) => ({
  id: user.id,
  login: user.login,
  role: user.role,
  created_at: user.created_at,
});

/** Логины сравниваем без учёта регистра, чтобы Ivan и ivan не были разными людьми. */
const findByLogin = (login) => db('users').whereRaw('lower(login) = lower(?)', [login]).first();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { login, password } = parse(credentials, req.body);

    if (await findByLogin(login)) {
      throw new ConflictError('Такой логин уже занят', 'LOGIN_TAKEN');
    }

    const [user] = await db('users')
      .insert({ login, role: DEFAULT_ROLE, password_hash: await hashPassword(password) })
      .returning('*');

    const token = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.status(201).json({ user: publicUser(user) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { login, password } = parse(credentials, req.body);
    const user = await findByLogin(login);

    // Один и тот же ответ на «нет такого логина» и «неверный пароль»:
    // иначе по коду ответа можно перебором узнать, кто зарегистрирован.
    const ok = user && (await verifyPassword(password, user.password_hash));
    if (!ok) throw new UnauthorizedError('Неверный логин или пароль');

    const token = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ user: publicUser(user) });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await destroySession(req.sessionToken);
    res.setHeader('Set-Cookie', clearedCookie());
    res.status(204).end();
  }),
);

/** Кто я сейчас. Отвечает 200 с null, а не 401: интерфейсу это удобнее. */
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

module.exports = router;
