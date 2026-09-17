const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

// Проверка доступа срабатывает раньше валидации тела и раньше поиска
// маршрута, поэтому нужна сессия с правом записи — иначе вместо 400 и 404
// придут 401 или 403.
const login = `valid_${Date.now()}`;
let cookie;

beforeAll(async () => {
  const res = await request(app).post('/auth/register').send({ login, password: 'warehouse-1' });
  cookie = res.headers['set-cookie'][0].split(';')[0];
  // Саморегистрация даёт наблюдателя, а проверке валидации нужна запись.
  await db('users').where({ login }).update({ role: 'staff' });
});

afterAll(async () => {
  await db('users').where({ login }).del();
  await db.destroy();
});

describe('Служебные маршруты', () => {
  it('GET /health отвечает 200 без обращения к БД', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('неизвестный маршрут отдаёт 404 в едином формате ошибки', async () => {
    const res = await request(app).get('/no-such-route').set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Валидация запросов', () => {
  it('продажа без обязательных полей отдаёт 400 с деталями', async () => {
    const res = await request(app).post('/sales').set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
