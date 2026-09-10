const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

afterAll(async () => {
  await db.destroy();
});

describe('Веб-интерфейс', () => {
  it('отдаётся по адресу /ui', async () => {
    const res = await request(app).get('/ui/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('отдаёт стили и скрипт', async () => {
    const css = await request(app).get('/ui/styles.css');
    const js = await request(app).get('/ui/app.js');
    expect(css.status).toBe(200);
    expect(js.status).toBe(200);
  });

  it('не перехватывает корень: там по-прежнему индекс API', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.resources).toBeDefined();
  });

  it('не ломает обработку неизвестных маршрутов', async () => {
    const res = await request(app).get('/ui/nope.html');
    expect(res.status).toBe(404);
  });
});
