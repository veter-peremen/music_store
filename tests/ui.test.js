const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

const login = `ui_${Date.now()}`;
let cookie;

beforeAll(async () => {
  const res = await request(app).post('/auth/register').send({ login, password: 'warehouse-1' });
  cookie = res.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => {
  await db('users').where({ login }).del();
  await db.destroy();
});

describe('Веб-интерфейс', () => {
  it('открывается в корне без входа — там форма входа', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('отдаёт стили и скрипт без входа', async () => {
    const css = await request(app).get('/styles.css');
    const js = await request(app).get('/app.js');
    expect(css.status).toBe(200);
    expect(js.status).toBe(200);
  });

  it('не перехватывает маршруты API: без входа они отвечают JSON-ошибкой, а не страницей', async () => {
    const res = await request(app).get('/records');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('индекс API доступен на /api', async () => {
    const res = await request(app).get('/api');
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.resources).toBeDefined();
  });

  it('несуществующий путь без входа не выдаёт, есть он или нет', async () => {
    const res = await request(app).get('/nope.html');
    expect(res.status).toBe(401);
  });

  it('несуществующий путь под сессией доходит до общего обработчика', async () => {
    const res = await request(app).get('/nope.html').set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
