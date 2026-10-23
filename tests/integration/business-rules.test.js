const request = require('supertest');
const createApp = require('../../src/app');
const db = require('../../src/db');
const knex = require('../../src/db'); 
const app = createApp();

// Уникальные данные для каждого прогона, чтобы тесты не мешали друг другу
const stamp = Date.now();
const adminLogin = `adm_${stamp}`;
let adminCookie;

// Хелпер для создания тестовых данных
const seedTestData = async () => {
  const [genre] = await db('genres').insert({ name: `TestGenre_${stamp}` }).returning('*');
  const [musician] = await db('musicians').insert({ name: `TestMusician_${stamp}` }).returning('*');
  const [record] = await db('records').insert({
    title: `TestRecord_${stamp}`,
    musician_id: musician.id,
    genre_id: genre.id,
    year: 2020,
    price: 1000,
    stock: 5,
  }).returning('*');
  
  return { genre, musician, record };
};

beforeAll(async () => {
  // 1. Регистрируем пользователя
  const regRes = await request(app)
    .post('/auth/register')
    .send({ login: adminLogin, password: 'TestPass123!' });

  // 2. Проверяем, что регистрация прошла успешно
  if (regRes.status !== 201) {
    console.error('Ошибка регистрации:', regRes.status, regRes.body);
    throw new Error(`Регистрация не удалась: ${regRes.status}`);
  }

  // 3. Достаём cookie безопасно
  const setCookie = regRes.headers['set-cookie'];
  if (!setCookie || !setCookie[0]) {
    throw new Error('Cookie не установлен после регистрации');
  }
  adminCookie = setCookie[0].split(';')[0];

  // 4. Повышаем до супермина
  await db('users').where({ login: adminLogin }).update({ role: 'superadmin' });
});

beforeEach(async () => {
  // Очищаем все таблицы перед каждым тестом
  await knex('sales').del();
  await knex('receipts').del();
  await knex('records').del();
  await knex('musicians').del();
  await knex('genres').del();
});

afterAll(async () => {
  await db('sales').whereRaw('record_id IN (SELECT id FROM records WHERE title LIKE ?)', [`%${stamp}%`]).del();
  await db('records').whereRaw('title LIKE ?', [`%${stamp}%`]).del();
  await db('musicians').whereRaw('name LIKE ?', [`%${stamp}%`]).del();
  await db('genres').whereRaw('name LIKE ?', [`%${stamp}%`]).del();
  await db('users').where({ login: adminLogin }).del();
  await db.destroy();
});

describe('4. Обязательные правила предметной области (Интеграционные)', () => {
  
  test('Правило: Нельзя продать больше, чем на остатке (HTTP 409)', async () => {
    const { record } = await seedTestData();
    
    const res = await request(app)
      .post('/sales')
      .set('Cookie', adminCookie)
      .send({ record_id: record.id, quantity: 10 }); // На складе только 5

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK'); // Или ваш код ошибки
  });

  test('Правило: Снимок цены (изменение price не меняет unit_price в старых продажах)', async () => {
    const { record } = await seedTestData();
    
    // 1. Продаем 1 шт по цене 1000
    await request(app)
      .post('/sales')
      .set('Cookie', adminCookie)
      .send({ record_id: record.id, quantity: 1 });

    // 2. Меняем цену в карточке на 2000
    await request(app)
      .patch(`/records/${record.id}`)
      .set('Cookie', adminCookie)
      .send({ price: 2000 });

    // 3. Проверяем, что в истории продаж осталась старая цена
    const sale = await db('sales').where({ record_id: record.id }).first();
    expect(Number(sale.unit_price)).toBe(1000);
    expect(Number(sale.total)).toBe(1000);
    
    // 4. Проверяем, что остаток уменьшился атомарно
    const updatedRecord = await db('records').where({ id: record.id }).first();
    expect(updatedRecord.stock).toBe(4);
  });

  test('Правило: С архивной пластинкой нельзя проводить движения (HTTP 409)', async () => {
    const { record } = await seedTestData();
    
    // Архивируем пластинку
    await request(app).delete(`/records/${record.id}`).set('Cookie', adminCookie);

    // Пытаемся продать
    const saleRes = await request(app)
      .post('/sales')
      .set('Cookie', adminCookie)
      .send({ record_id: record.id, quantity: 1 });
    expect(saleRes.status).toBe(409);
    expect(saleRes.body.error.code).toMatch(/ARCHIVED/i);

    // Пытаемся оприходовать
    const receiptRes = await request(app)
      .post(`/records/${record.id}/receipts`)
      .set('Cookie', adminCookie)
      .send({ quantity: 5 });
    expect(receiptRes.status).toBe(409);
  });

  test('Правило: Восстановление пластинки при архивном музыканте запрещено (HTTP 409)', async () => {
    const { musician, record } = await seedTestData();
    
    // Архивируем музыканта (по ТЗ это каскадно архивирует пластинки)
    await request(app).delete(`/musicians/${musician.id}`).set('Cookie', adminCookie);
    
    // Пытаемся восстановить пластинку, не восстановив музыканта
    const res = await request(app)
      .post(`/records/${record.id}/restore`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toMatch(/MUSICIAN_ARCHIVED/i);
  });

  test('Правило: Нельзя удалить жанр, если на него ссылается пластинка (даже архивная) (HTTP 409)', async () => {
    const { genre, record } = await seedTestData();
    
    // Даже если мы архивируем пластинку, жанр удалять нельзя
    await request(app).delete(`/records/${record.id}`).set('Cookie', adminCookie);

    const res = await request(app)
      .delete(`/genres/${genre.id}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toMatch(/IN_USE|CONFLICT/i);
  });
});
