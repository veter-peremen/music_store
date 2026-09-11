const { COOKIE_NAME, findSessionUser } = require('../sessions');
const { parseCookies } = require('../utils/cookies');
const { UnauthorizedError, ForbiddenError } = require('../errors');
const { canMutate, canManageUsers } = require('../domain/roles');

/** Методы, которые ничего не меняют и потому остаются открытыми. */
const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Опознаёт пользователя по сессионной куке и кладёт его в req.user.
 * Никого не отвергает: решение принимает requireAuthForWrites.
 */
async function attachUser(req, _res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    req.sessionToken = token || null;
    req.user = token ? await findSessionUser(token) : null;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Закрывает изменяющие операции. Чтение каталога, остатков и отчётов
 * остаётся доступным без входа — смотреть витрину может кто угодно,
 * а продавать и править справочники только свои.
 */
function requireAuthForWrites(req, _res, next) {
  if (READ_ONLY.has(req.method)) return next();
  if (!req.user) return next(new UnauthorizedError('Эта операция требует входа в систему'));
  if (!canMutate(req.user.role)) {
    return next(new ForbiddenError('Ваша роль позволяет только просмотр'));
  }
  next();
}

/** Управление учётными записями доступно только суперадминистратору. */
function requireUserManager(req, _res, next) {
  if (!req.user) return next(new UnauthorizedError('Эта операция требует входа в систему'));
  if (!canManageUsers(req.user.role)) {
    return next(new ForbiddenError('Управлять учётными записями может только суперадминистратор'));
  }
  next();
}

module.exports = { attachUser, requireAuthForWrites, requireUserManager };
