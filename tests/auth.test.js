const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');

const app = createApp();

// Тесты ходят в ту же базу, что и разработка, поэтому логин у каждого
// прогона свой, а созданное за собой убираем.
const login = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
const password = 'warehouse-1';

afterAll(async () => {
  await db('users').whereRaw('lower(login) = lower(?)', [login]).del();
  await db.destroy();
});

/** Достаёт значение сессионной куки из ответа. */
const cookieFrom = (res) => {
  const raw = res.headers['set-cookie'];
  return raw ? raw[0].split(';')[0] : null;
};

describe('Что доступно без входа', () => {
  it('чтение каталога открыто', async () => {
    const res = await request(app).get('/records');
    expect(res.status).toBe(200);
  });

  it('изменение отклоняется с кодом 401', async () => {
    const res = await request(app).post('/genres').send({ name: 'NoAuthGenre' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('«кто я» отвечает пустым пользователем, а не ошибкой', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe('Регистрация', () => {
  it('создаёт учётную запись и сразу выдаёт сессию', async () => {
    const res = await request(app).post('/auth/register').send({ login, password });
    expect(res.status).toBe(201);
    expect(res.body.user.login).toBe(login);
    expect(cookieFrom(res)).toMatch(/^session=/);
  });

  it('не отдаёт наружу хеш пароля', async () => {
    const res = await request(app).get('/auth/me');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('занятый логин отклоняется без учёта регистра', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ login: login.toUpperCase(), password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LOGIN_TAKEN');
  });

  it('короткий пароль и короткий логин отклоняются с разбором полей', async () => {
    const res = await request(app).post('/auth/register').send({ login: 'ab', password: '123' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['login', 'password']));
  });
});

describe('Вход и выход', () => {
  it('неверный пароль и несуществующий логин отвечают одинаково', async () => {
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ login, password: 'nope-nope' });
    const noSuchUser = await request(app)
      .post('/auth/login')
      .send({ login: 'nobody_here_x', password: 'nope-nope' });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body).toEqual(noSuchUser.body);
  });

  it('после входа изменения разрешены, после выхода — снова нет', async () => {
    const entered = await request(app).post('/auth/login').send({ login, password });
    expect(entered.status).toBe(200);
    const cookie = cookieFrom(entered);

    const created = await request(app)
      .post('/genres')
      .set('Cookie', cookie)
      .send({ name: `Genre_${login}` });
    expect(created.status).toBe(201);
    await db('genres').where({ id: created.body.id }).del();

    const left = await request(app).post('/auth/logout').set('Cookie', cookie);
    expect(left.status).toBe(204);

    const afterLogout = await request(app)
      .post('/genres')
      .set('Cookie', cookie)
      .send({ name: 'AfterLogout' });
    expect(afterLogout.status).toBe(401);
  });
});
