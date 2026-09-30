/**
 * Разбор и сборка cookie без сторонних библиотек.
 * Нужен минимум: одна сессионная кука, поэтому cookie-parser избыточен.
 */

/** Разбирает заголовок Cookie в объект. Испорченные пары молча пропускает. */
function parseCookies(header) {
  const result = {};
  if (!header) return result;

  String(header)
    .split(';')
    .forEach((pair) => {
      const index = pair.indexOf('=');
      if (index < 1) return;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (name) result[name] = decodeURIComponent(value);
    });

  return result;
}

/** Собирает значение заголовка Set-Cookie. */
function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path || '/'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure) parts.push('Secure');

  return parts.join('; ');
}

module.exports = { parseCookies, serializeCookie };
