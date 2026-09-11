const { COOKIE_NAME, findSessionUser } = require('../sessions');
const { parseCookies } = require('../utils/cookies');
const { UnauthorizedError } = require('../errors');

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
  if (READ_ONLY.has(req.method) || req.user) return next();
  next(new UnauthorizedError('Эта операция требует входа в систему'));
}

module.exports = { attachUser, requireAuthForWrites };
