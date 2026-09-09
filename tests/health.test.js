const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

afterAll(async () => {
  await db.destroy();
});

describe('Служебные маршруты', () => {
  it('GET /health отвечает 200 без обращения к БД', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('неизвестный маршрут отдаёт 404 в едином формате ошибки', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Валидация запросов', () => {
  it('продажа без обязательных полей отдаёт 400 с деталями', async () => {
    const res = await request(app).post('/sales').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
