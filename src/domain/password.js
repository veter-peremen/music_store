const { scrypt, randomBytes, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'scrypt';
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

/**
 * Превращает пароль в строку вида scrypt$соль$хеш.
 *
 * Соль своя у каждого пароля: одинаковые пароли двух пользователей дадут
 * разные хеши, поэтому по базе нельзя увидеть, что пароли совпадают.
 * Алгоритм записан в саму строку — если однажды он сменится, старые
 * записи останутся читаемыми.
 */
async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return [ALGORITHM, salt.toString('hex'), key.toString('hex')].join('$');
}

/**
 * Сверяет пароль с сохранённым хешем.
 *
 * Сравнение идёт timingSafeEqual, а не обычным равенством: обычное
 * сравнение выходит из цикла на первом несовпавшем байте, и по времени
 * ответа можно угадывать хеш байт за байтом.
 */
async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== ALGORITHM) return false;

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length !== SALT_BYTES || expected.length !== KEY_LENGTH) return false;

  const actual = await scryptAsync(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
