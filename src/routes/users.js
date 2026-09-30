const express = require('express');

const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { hashPassword } = require('../domain/password');
const { canManageUsers, isLastSuperadmin } = require('../domain/roles');
const { ConflictError, NotFoundError } = require('../errors');
const { parse, idParam, userCreate, userUpdate } = require('../validation/schemas');

const router = express.Router();

const publicUser = (user) => ({
  id: user.id,
  login: user.login,
  role: user.role,
  created_at: user.created_at,
});

const findByLogin = (login) => db('users').whereRaw('lower(login) = lower(?)', [login]).first();

const findUser = async (id) => {
  const user = await db('users').where({ id }).first();
  if (!user) throw new NotFoundError(`Учётная запись id=${id} не найдена`);
  return user;
};

/**
 * Система не должна остаться без суперадминистратора: иначе управлять
 * учётными записями станет некому и починить это можно будет только
 * руками в базе.
 */
const assertNotLastSuperadmin = async (user, action) => {
  if (user.role !== 'superadmin') return;
  const [{ count }] = await db('users').where({ role: 'superadmin' }).count({ count: '*' });
  if (isLastSuperadmin(user.role, count)) {
    throw new ConflictError(
      `Нельзя ${action} последнего суперадминистратора: без него некому управлять учётными записями`,
      'LAST_SUPERADMIN',
    );
  }
};

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await db('users').orderBy('id');
    res.json(users.map(publicUser));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { login, password, role } = parse(userCreate, req.body);

    if (await findByLogin(login)) {
      throw new ConflictError('Такой логин уже занят', 'LOGIN_TAKEN');
    }

    const [user] = await db('users')
      .insert({ login, role, password_hash: await hashPassword(password) })
      .returning('*');

    res.status(201).json(publicUser(user));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { role } = parse(userUpdate, req.body);
    const user = await findUser(id);

    // Снять с себя права суперадминистратора — верный способ запереть
    // себя снаружи, поэтому запрещаем явно.
    if (user.id === req.user.id && !canManageUsers(role)) {
      throw new ConflictError('Нельзя снять права с самого себя', 'SELF_DEMOTE');
    }
    if (user.role !== role) await assertNotLastSuperadmin(user, 'понизить');

    const [updated] = await db('users')
      .where({ id })
      .update({ role, updated_at: db.fn.now() })
      .returning('*');

    res.json(publicUser(updated));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const user = await findUser(id);

    if (user.id === req.user.id) {
      throw new ConflictError('Нельзя удалить собственную учётную запись', 'SELF_DELETE');
    }
    await assertNotLastSuperadmin(user, 'удалить');

    // Сессии уходят вместе с пользователем: внешний ключ с CASCADE,
    // поэтому удалённый сотрудник теряет доступ сразу.
    await db('users').where({ id }).del();
    res.status(204).end();
  }),
);

module.exports = router;
