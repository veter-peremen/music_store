const { COOKIE_NAME, findSessionUser } = require('../sessions');
const { parseCookies } = require('../utils/cookies');
const { UnauthorizedError, ForbiddenError } = require('../errors');
const { canMutate, canManageUsers } = require('../domain/roles');

/** Методы, которые ничего не меняют: для них достаточно войти, роль не важна. */
const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Опознаёт пользователя по сессионной куке и кладёт его в req.user.
 * Никого не отвергает: решение принимает requireAccess.
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
 * Закрывает данные магазина от анонимов целиком: без входа нельзя ни
 * менять, ни читать — иначе каталог утекал бы обычным curl в обход
 * интерфейса. Вошедшим читать можно всем, менять — только ролям с правом
 * записи.
 */
function requireAccess(req, _res, next) {
  if (!req.user) return next(new UnauthorizedError('Требуется вход в систему'));
  if (READ_ONLY.has(req.method)) return next();
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

module.exports = { attachUser, requireAccess, requireUserManager };
