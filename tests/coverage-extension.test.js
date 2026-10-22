const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

const stamp = Date.now() + 3;
const adminLogin = `adm_coverage_${stamp}`;
let adminCookie;

beforeAll(async () => {
  const regRes = await request(app)
    .post('/auth/register')
    .send({ login: adminLogin, password: 'TestPass123!' });
  adminCookie = regRes.headers['set-cookie'][0].split(';')[0];
  await db('users').where({ login: adminLogin }).update({ role: 'superadmin' });
});

afterAll(async () => {
  await db('sales').whereRaw('record_id IN (SELECT id FROM records WHERE title LIKE ?)', [`%COV_${stamp}%`]).del();
  await db('records').whereRaw('title LIKE ?', [`%COV_${stamp}%`]).del();
  await db('musicians').whereRaw('name LIKE ?', [`%COV_${stamp}%`]).del();
  await db('genres').whereRaw('name LIKE ?', [`%COV_${stamp}%`]).del();
  await db('users').where({ login: adminLogin }).del();
  await db.destroy();
});

describe('4. Покрытие недостающего функционала (≥40%)', () => {
  
  describe('API: Жанры - CRUD операции', () => {
    let genreId;

    test('POST /genres - создание жанра', async () => {
      const res = await request(app)
        .post('/genres')
        .set('Cookie', adminCookie)
        .send({ name: `Genre_COV_1_${stamp}` });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(`Genre_COV_1_${stamp}`);
      genreId = res.body.id;
    });

    test('GET /genres - получение списка жанров', async () => {
      const res = await request(app)
        .get('/genres')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(g => g.id === genreId)).toBe(true);
    });

    test('GET /genres/:id - получение конкретного жанра', async () => {
      const res = await request(app)
        .get(`/genres/${genreId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(genreId);
    });

    test('PATCH /genres/:id - обновление жанра', async () => {
      const res = await request(app)
        .patch(`/genres/${genreId}`)
        .set('Cookie', adminCookie)
        .send({ name: `Genre_COV_1_Updated_${stamp}` });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(`Genre_COV_1_Updated_${stamp}`);
    });

    test('DELETE /genres/:id - удаление жанра', async () => {
      const res = await request(app)
        .delete(`/genres/${genreId}`)
        .set('Cookie', adminCookie);

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('API: Музыканты - CRUD операции', () => {
    let musicianId;

    test('POST /musicians - создание музыканта', async () => {
      const res = await request(app)
        .post('/musicians')
        .set('Cookie', adminCookie)
        .send({ name: `Musician_COV_${stamp}`, country: 'UK' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(`Musician_COV_${stamp}`);
      musicianId = res.body.id;
    });

    test('GET /musicians - получение списка', async () => {
      const res = await request(app)
        .get('/musicians')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /musicians/:id - получение конкретного музыканта', async () => {
      const res = await request(app)
        .get(`/musicians/${musicianId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(musicianId);
    });

    test('PATCH /musicians/:id - обновление', async () => {
      const res = await request(app)
        .patch(`/musicians/${musicianId}`)
        .set('Cookie', adminCookie)
        .send({ country: 'USA' });

      expect(res.status).toBe(200);
    });
  });

  describe('API: Пластинки - расширенные операции', () => {
    let recordId;

    beforeAll(async () => {
      const [genre] = await db('genres').insert({ name: `Genre_COV_2_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_COV_2_${stamp}` }).returning('*');
      const [record] = await db('records').insert({
        title: `Record_COV_${stamp}`,
        musician_id: musician.id,
        genre_id: genre.id,
        year: 2020,
        price: 1500,
        stock: 10
      }).returning('*');
      recordId = record.id;
    });

    test('GET /records - фильтрация по параметрам', async () => {
      const res = await request(app)
        .get('/records')
        .set('Cookie', adminCookie)
        .query({ archived: false });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /records/:id - получение конкретной пластинки', async () => {
      const res = await request(app)
        .get(`/records/${recordId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(recordId);
      expect(res.body.title).toBe(`Record_COV_${stamp}`);
    });

    test('PATCH /records/:id - частичное обновление', async () => {
      const res = await request(app)
        .patch(`/records/${recordId}`)
        .set('Cookie', adminCookie)
        .send({ year: 2021 });

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2021);
    });

    test('DELETE /records/:id - архивация (мягкое удаление)', async () => {
      const res = await request(app)
        .delete(`/records/${recordId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      
      const archived = await db('records').where({ id: recordId }).first();
      expect(archived.archived_at).not.toBeNull();
    });

    test('POST /records/:id/restore - восстановление из архива', async () => {
      const res = await request(app)
        .post(`/records/${recordId}/restore`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      
      const restored = await db('records').where({ id: recordId }).first();
      expect(restored.archived_at).toBeNull();
    });
  });

  describe('API: Продажи - история и фильтрация', () => {
    let recordId;

    beforeAll(async () => {
      const [genre] = await db('genres').insert({ name: `Genre_COV_3_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_COV_3_${stamp}` }).returning('*');
      const [record] = await db('records').insert({
        title: `Record_COV_Sale_${stamp}`,
        musician_id: musician.id,
        genre_id: genre.id,
        year: 2020,
        price: 2000,
        stock: 20
      }).returning('*');
      recordId = record.id;
    });

    test('POST /sales - оформление продажи', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Cookie', adminCookie)
        .send({ record_id: recordId, quantity: 3 });

      expect(res.status).toBe(201);
      expect(res.body.quantity).toBe(3);
      expect(res.body.total).toBeDefined();
    });

    test('GET /sales - получение истории продаж', async () => {
      const res = await request(app)
        .get('/sales')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /sales - фильтрация по record_id', async () => {
      const res = await request(app)
        .get('/sales')
        .set('Cookie', adminCookie)
        .query({ record_id: recordId });

      expect(res.status).toBe(200);
      expect(res.body.every(s => s.record_id === recordId)).toBe(true);
    });
  });

  describe('API: Отчёты', () => {
    test('GET /reports/top-sellers - получение отчёта "Топ продаж"', async () => {
      const res = await request(app)
        .get('/reports/top-sellers')
        .set('Cookie', adminCookie)
        .query({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    test('GET /reports/top-sellers - отчёт с параметром archived', async () => {
      const res = await request(app)
        .get('/reports/top-sellers')
        .set('Cookie', adminCookie)
        .query({ limit: 5, archived: false });

      expect(res.status).toBe(200);
    });
  });
});
