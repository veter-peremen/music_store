#!/usr/bin/env node

/**
 * Назначает роль учётной записи.
 *
 * Нужен для первого запуска: первого суперадминистратора некому назначить
 * через API, потому что управлять ролями может только суперадминистратор.
 * Дальше роли меняются в интерфейсе.
 *
 *   node scripts/grant-role.js superadmin superadmin
 */

const db = require('../src/db');
const { ROLES, isKnownRole } = require('../src/domain/roles');

const [login, role] = process.argv.slice(2);

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

async function main() {
  if (!login || !role) {
    return fail(
      `Использование: node scripts/grant-role.js <логин> <роль>\nРоли: ${ROLES.join(', ')}`,
    );
  }
  if (!isKnownRole(role)) {
    return fail(`Неизвестная роль «${role}». Допустимые: ${ROLES.join(', ')}`);
  }

  const updated = await db('users')
    .whereRaw('lower(login) = lower(?)', [login])
    .update({ role, updated_at: db.fn.now() })
    .returning(['id', 'login', 'role']);

  if (updated.length === 0) {
    return fail(`Учётная запись «${login}» не найдена`);
  }

  console.log(`${updated[0].login} -> ${updated[0].role}`);
}

main()
  .catch((err) => fail(err.message))
  .finally(() => db.destroy());
