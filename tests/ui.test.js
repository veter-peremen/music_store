const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

afterAll(async () => {
  await db.destroy();
});

describe('Веб-интерфейс', () => {
  it('открывается в корне', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('отдаёт стили и скрипт', async () => {
    const css = await request(app).get('/styles.css');
    const js = await request(app).get('/app.js');
    expect(css.status).toBe(200);
    expect(js.status).toBe(200);
  });

  it('не перехватывает маршруты API', async () => {
    const records = await request(app).get('/records');
    expect(records.status).toBe(200);
    expect(records.headers['content-type']).toMatch(/json/);
  });

  it('индекс API доступен на /api', async () => {
    const res = await request(app).get('/api');
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.resources).toBeDefined();
  });

  it('несуществующий файл доходит до общего обработчика', async () => {
    const res = await request(app).get('/nope.html');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
