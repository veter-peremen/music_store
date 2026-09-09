const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

afterAll(async () => {
  await db.destroy();
});

describe('Корневой индекс API', () => {
  it('GET / отвечает 200 и не уходит в 404', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('сообщает версию сервиса', async () => {
    const res = await request(app).get('/');
    expect(res.body.version).toBe(require('../package.json').version);
  });

  it('перечисляет доступные маршруты', async () => {
    const res = await request(app).get('/');
    const listed = JSON.stringify(res.body);
    expect(listed).toContain('/health');
    expect(listed).toContain('/records');
    expect(listed).toContain('/reports/top-sellers');
  });
});
