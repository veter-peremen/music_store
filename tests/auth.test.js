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
  it('чтение данных закрыто так же, как изменение', async () => {
    for (const path of ['/records', '/genres', '/musicians', '/sales', '/reports/top-sellers']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('форма входа и проверки живости доступны без входа', async () => {
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/health')).status).toBe(200);
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

  it('зарегистрировавшийся сам получает роль наблюдателя', async () => {
    const user = await db('users').whereRaw('lower(login) = lower(?)', [login]).first();
    expect(user.role).toBe('viewer');
  });

  it('роль из тела запроса при регистрации игнорируется', async () => {
    const sneaky = `${login}_x`;
    const res = await request(app)
      .post('/auth/register')
      .send({ login: sneaky, password, role: 'superadmin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('viewer');
    await db('users').where({ login: sneaky }).del();
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

  it('после входа наблюдатель читает, но не меняет', async () => {
    const cookie = cookieFrom(await request(app).post('/auth/login').send({ login, password }));

    const read = await request(app).get('/records').set('Cookie', cookie);
    expect(read.status).toBe(200);

    const write = await request(app).post('/genres').set('Cookie', cookie).send({ name: 'Nope' });
    expect(write.status).toBe(403);
  });

  it('после выдачи прав изменения разрешены, после выхода — снова нет', async () => {
    const entered = await request(app).post('/auth/login').send({ login, password });
    expect(entered.status).toBe(200);
    const cookie = cookieFrom(entered);

    // Роль читается из базы на каждом запросе, поэтому повторный вход не нужен.
    await db('users').whereRaw('lower(login) = lower(?)', [login]).update({ role: 'staff' });

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
