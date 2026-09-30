/**
 * Учётные записи и сессии.
 *
 * Пароль хранится только как результат scrypt с индивидуальной солью —
 * исходный пароль в базе не появляется ни в каком виде. В сессиях лежит
 * не сам токен из cookie, а его отпечаток: утечка дампа базы не даст
 * войти под чужой учёткой.
 */

exports.up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('login', 32).notNullable().unique();
    t.text('password_hash').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('sessions', (t) => {
    t.string('token_hash', 64).primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('user_id', 'sessions_user_id_idx');
    t.index('expires_at', 'sessions_expires_at_idx');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('users');
};
