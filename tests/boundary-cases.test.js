const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

const stamp = Date.now() + 2;
const adminLogin = `adm_boundary_${stamp}`;
let adminCookie;

beforeAll(async () => {
  const regRes = await request(app)
    .post('/auth/register')
    .send({ login: adminLogin, password: 'TestPass123!' });
  adminCookie = regRes.headers['set-cookie'][0].split(';')[0];
  await db('users').where({ login: adminLogin }).update({ role: 'superadmin' });
});

afterAll(async () => {
  await db('sales').whereRaw('record_id IN (SELECT id FROM records WHERE title LIKE ?)', [`%BOUND_${stamp}%`]).del();
  await db('records').whereRaw('title LIKE ?', [`%BOUND_${stamp}%`]).del();
  await db('musicians').whereRaw('name LIKE ?', [`%BOUND_${stamp}%`]).del();
  await db('genres').whereRaw('name LIKE ?', [`%BOUND_${stamp}%`]).del();
  await db('users').where({ login: adminLogin }).del();
  await db.destroy();
});

describe('5. Граничные случаи и ошибочные данные', () => {
  
  describe('Граничные значения для количества', () => {
    it('отклоняет quantity = 0 при продаже', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_1_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_BOUND_1_${stamp}` }).returning('*');
      const [record] = await db('records').insert({
        title: `Record_BOUND_1_${stamp}`,
        musician_id: musician.id,
        genre_id: genre.id,
        year: 2020,
        price: 1000,
        stock: 10
      }).returning('*');

      const res = await request(app)
        .post('/sales')
        .set('Cookie', adminCookie)
        .send({ record_id: record.id, quantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('отклоняет отрицательное quantity', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Cookie', adminCookie)
        .send({ record_id: 1, quantity: -5 });

      expect(res.status).toBe(400);
    });

    it('отклоняет дробное quantity', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Cookie', adminCookie)
        .send({ record_id: 1, quantity: 2.5 });

      expect(res.status).toBe(400);
    });

    it('принимает очень большое количество (граничное значение)', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_2_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_BOUND_2_${stamp}` }).returning('*');
      const [record] = await db('records').insert({
        title: `Record_BOUND_2_${stamp}`,
        musician_id: musician.id,
        genre_id: genre.id,
        year: 2020,
        price: 1000,
        stock: 1000000
      }).returning('*');

      const res = await request(app)
        .post('/sales')
        .set('Cookie', adminCookie)
        .send({ record_id: record.id, quantity: 999999 });

      expect(res.status).toBe(201);
    });
  });

  describe('Граничные значения для цены', () => {
    it('отклоняет отрицательную цену', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_3_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_BOUND_3_${stamp}` }).returning('*');

      const res = await request(app)
        .post('/records')
        .set('Cookie', adminCookie)
        .send({
          title: `Record_BOUND_3_${stamp}`,
          musician_id: musician.id,
          genre_id: genre.id,
          year: 2020,
          price: -100,
          stock: 5
        });

      expect(res.status).toBe(400);
    });

    it('принимает цену 0.01 (минимальная возможная)', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_4_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_BOUND_4_${stamp}` }).returning('*');

      const res = await request(app)
        .post('/records')
        .set('Cookie', adminCookie)
        .send({
          title: `Record_BOUND_4_${stamp}`,
          musician_id: musician.id,
          genre_id: genre.id,
          year: 2020,
          price: 0.01,
          stock: 5
        });

      expect(res.status).toBe(201);
    });

    it('принимает очень большую цену', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_5_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_BOUND_5_${stamp}` }).returning('*');

      const res = await request(app)
        .post('/records')
        .set('Cookie', adminCookie)
        .send({
          title: `Record_BOUND_5_${stamp}`,
          musician_id: musician.id,
          genre_id: genre.id,
          year: 2020,
          price: 999999.99,
          stock: 5
        });

      expect(res.status).toBe(201);
    });
  });

  describe('Ошибочные данные и валидация', () => {
    it('отклоняет создание пользователя с пустым login', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ login: '', password: 'TestPass123!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('отклоняет создание пользователя с коротким паролем', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ login: `test_user_${stamp}`, password: '12' });

      expect(res.status).toBe(400);
    });

    it('отклоняет несуществующий musician_id', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_6_${stamp}` }).returning('*');

      const res = await request(app)
        .post('/records')
        .set('Cookie', adminCookie)
        .send({
          title: `Record_BOUND_6_${stamp}`,
          musician_id: 999999,
          genre_id: genre.id,
          year: 2020,
          price: 1000,
          stock: 5
        });

      expect(res.status).toBe(400);
    });

    it('отклоняет год в будущем', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_7_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_BOUND_7_${stamp}` }).returning('*');

      const res = await request(app)
        .post('/records')
        .set('Cookie', adminCookie)
        .send({
          title: `Record_BOUND_7_${stamp}`,
          musician_id: musician.id,
          genre_id: genre.id,
          year: 3000,
          price: 1000,
          stock: 5
        });

      expect(res.status).toBe(400);
    });

    it('отклоняет строку вместо числа в price', async () => {
      const [genre] = await db('genres').insert({ name: `Genre_BOUND_8_${stamp}` }).returning('*');
      const [musician] = await db('musicians').insert({ name: `Musician_BOUND_8_${stamp}` }).returning('*');

      const res = await request(app)
        .post('/records')
        .set('Cookie', adminCookie)
        .send({
          title: `Record_BOUND_8_${stamp}`,
          musician_id: musician.id,
          genre_id: genre.id,
          year: 2020,
          price: 'not-a-number',
          stock: 5
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Пустые и null значения', () => {
    it('обрабатывает пустой список продаж', async () => {
      const res = await request(app)
        .get('/sales')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('возвращает 404 для несуществующей пластинки', async () => {
      const res = await request(app)
        .get('/records/999999')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
    });
  });
});
