const request = require('supertest');
const createApp = require('../../src/app');
const db = require('../../src/db');

const app = createApp();
const stamp = Date.now() + 1; // Другой stamp, чтобы не пересекаться
const adminLogin = `adm_mov_${stamp}`;
let adminCookie;

beforeAll(async () => {
  const regRes = await request(app)
    .post('/auth/register')
    .send({ login: adminLogin, password: 'TestPass123!' });

  if (regRes.status !== 201) {
    console.error('Ошибка регистрации:', regRes.status, regRes.body);
    throw new Error(`Регистрация не удалась: ${regRes.status}`);
  }

  const setCookie = regRes.headers['set-cookie'];
  if (!setCookie || !setCookie[0]) {
    throw new Error('Cookie не установлен после регистрации');
  }
  adminCookie = setCookie[0].split(';')[0];

  await db('users').where({ login: adminLogin }).update({ role: 'superadmin' });
});

afterAll(async () => {
  await db('receipts').whereRaw('record_id IN (SELECT id FROM records WHERE title LIKE ?)', [`%MOV_${stamp}%`]).del();
  await db('sales').whereRaw('record_id IN (SELECT id FROM records WHERE title LIKE ?)', [`%MOV_${stamp}%`]).del();
  await db('records').whereRaw('title LIKE ?', [`%MOV_${stamp}%`]).del();
  await db('musicians').whereRaw('name LIKE ?', [`%MOV_${stamp}%`]).del();
  await db('genres').whereRaw('name LIKE ?', [`%MOV_${stamp}%`]).del();
  await db('users').where({ login: adminLogin }).del();
  await db.destroy();
});

describe('Сценарии: Пластинки и Движения', () => {
  let genreId, musicianId, recordId;

  beforeAll(async () => {
    const [genre] = await db('genres').insert({ name: `Genre_MOV_${stamp}` }).returning('*');
    const [musician] = await db('musicians').insert({ name: `Musician_MOV_${stamp}` }).returning('*');
    genreId = genre.id;
    musicianId = musician.id;
  });

  test('Сценарий: Создание карточки пластинки', async () => {
    const res = await request(app)
      .post('/records')
      .set('Cookie', adminCookie)
      .send({
        title: `Record_MOV_${stamp}`,
        musician_id: musicianId,
        genre_id: genreId,
        year: 2024,
        price: 1500,
        stock: 10
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe(`Record_MOV_${stamp}`);
    expect(res.body.stock).toBe(10);
    recordId = res.body.id;
  });

  test('Сценарий: Оформление поступления (увеличивает stock)', async () => {
    const res = await request(app)
      .post(`/records/${recordId}/receipts`)
      .set('Cookie', adminCookie)
      .send({ quantity: 5 });

    expect(res.status).toBe(201); // или 200, зависит от вашей реализации
    
    const updated = await db('records').where({ id: recordId }).first();
    expect(updated.stock).toBe(15); // 10 + 5
  });

  test('Сценарий: Архивация и восстановление пластинки', async () => {
    // 1. Архивируем
    const delRes = await request(app).delete(`/records/${recordId}`).set('Cookie', adminCookie);
    expect(delRes.status).toBe(200); // или 204

    const archived = await db('records').where({ id: recordId }).first();
    expect(archived.archived_at).not.toBeNull();

    // 2. Восстанавливаем
    const restoreRes = await request(app).post(`/records/${recordId}/restore`).set('Cookie', adminCookie);
    expect(restoreRes.status).toBe(200); // или 204

    const restored = await db('records').where({ id: recordId }).first();
    expect(restored.archived_at).toBeNull();
  });

  test('Сценарий: GET /reports/top-sellers возвращает данные с флагом archived', async () => {
    // Сначала сделаем продажу, чтобы отчет был не пустым
    await request(app).post('/sales').set('Cookie', adminCookie).send({ record_id: recordId, quantity: 2 });

    const res = await request(app).get('/reports/top-sellers?limit=5').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    
    // Проверяем, что в отчете есть поле archived (даже если оно false)
    if (res.body.items.length > 0) {
      expect(res.body.items[0]).toHaveProperty('archived');
    }
  });
});
