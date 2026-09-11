/**
 * Роли учётных записей.
 *
 * Три роли с разными правами, а не список должностей: superadmin
 * управляет пользователями, staff меняет данные магазина, viewer только
 * смотрит. Должности из ТЗ (продавец, кладовщик, управляющий) — это staff.
 *
 * По умолчанию staff: при саморегистрации человек сразу может работать,
 * как было до появления ролей. Повысить до superadmin может только
 * действующий superadmin.
 */

const ROLES = ['superadmin', 'staff', 'viewer'];

exports.up = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.string('role', 16).notNullable().defaultTo('staff');
  });

  // Параметры в DDL PostgreSQL не принимает, поэтому список ролей
  // подставляется в текст запроса. Значения заданы здесь же в коде,
  // снаружи в него ничего не попадает.
  const allowed = ROLES.map((role) => `'${role}'`).join(', ');
  await knex.raw(
    `ALTER TABLE users ADD CONSTRAINT users_role_allowed CHECK (role IN (${allowed}))`,
  );

  await knex.schema.alterTable('users', (t) => {
    t.index('role', 'users_role_idx');
  });
};

exports.down = async (knex) => {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_allowed');
  await knex.schema.alterTable('users', (t) => {
    t.dropIndex('role', 'users_role_idx');
    t.dropColumn('role');
  });
};
