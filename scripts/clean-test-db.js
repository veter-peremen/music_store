
require('dotenv').config();

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || '192.168.57.101',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'music_store_test',
    user: process.env.DB_USER || 'ozzy',
    password: process.env.DB_PASSWORD,
  },
});

async function cleanTestDb() {
  console.log('🧹 Очищаем тестовую базу данных...');

  try {
    await knex('sales').del();
    console.log('sales очищена');

    await knex('receipts').del();
    console.log('receipts очищена');

    await knex('sessions').del();
    console.log('sessions очищена');

    await knex('records').del();
    console.log('records очищена');

    await knex('musicians').del();
    console.log('musicians очищена');

    await knex('genres').del();
    console.log('genres очищена');

    // Удаляем тестовых пользователей (оставляем только если нужно)
    await knex('users').where('login', 'like', 'test_%').del();
    await knex('users').where('login', 'like', 'adm_%').del();
    await knex('users').where('login', 'like', 'stf_%').del();
    await knex('users').where('login', 'like', 'usr_%').del();
    console.log('тестовые пользователи удалены');

    console.log('Тестовая база очищена!');
  } catch (err) {
    console.error('Ошибка при очистке:', err.message);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

cleanTestDb();
