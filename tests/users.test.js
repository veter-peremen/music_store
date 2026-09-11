const request = require('supertest');
const createApp = require('../src/app');
const db = require('../src/db');
const { hashPassword } = require('../src/domain/password');

const app = createApp();

const stamp = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
const adminLogin = `adm_${stamp}`;
const staffLogin = `stf_${stamp}`;
const password = 'warehouse-1';

let adminCookie;
let staffCookie;

/** Заводит пользователя напрямую в базе: назначить роль через API может только superadmin. */
const seedUser = async (login, role) => {
  const [user] = await db('users')
    .insert({ login, role, password_hash: await hashPassword(password) })
    .returning('*');
  return user;
};

const loginAs = async (login) => {
  const res = await request(app).post('/auth/login').send({ login, password });
  return res.headers['set-cookie'][0].split(';')[0];
};

beforeAll(async () => {
  await seedUser(adminLogin, 'superadmin');
  await seedUser(staffLogin, 'staff');
  adminCookie = await loginAs(adminLogin);
  staffCookie = await loginAs(staffLogin);
});

afterAll(async () => {
  await db('users')
    .whereIn('login', [adminLogin, staffLogin])
    .orWhere('login', 'like', `usr_${stamp}%`)
    .del();
  await db.destroy();
});

describe('Доступ к управлению учётными записями', () => {
  it('без входа — 401', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('сотруднику закрыто даже чтение списка', async () => {
    const res = await request(app).get('/users').set('Cookie', staffCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('суперадминистратор видит список без хешей паролей', async () => {
    const res = await request(app).get('/users').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

describe('Права роли viewer', () => {
  it('читать можно, менять нельзя', async () => {
    const viewerLogin = `usr_${stamp}_v`;
    await seedUser(viewerLogin, 'viewer');
    const cookie = await loginAs(viewerLogin);

    const read = await request(app).get('/records').set('Cookie', cookie);
    expect(read.status).toBe(200);

    const write = await request(app).post('/genres').set('Cookie', cookie).send({ name: 'Nope' });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  });
});

describe('Управление учётными записями', () => {
  it('создание с указанной ролью', async () => {
    const res = await request(app)
      .post('/users')
      .set('Cookie', adminCookie)
      .send({ login: `usr_${stamp}_a`, password, role: 'viewer' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('viewer');
  });

  it('недопустимая роль отклоняется', async () => {
    const res = await request(app)
      .post('/users')
      .set('Cookie', adminCookie)
      .send({ login: `usr_${stamp}_b`, password, role: 'root' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('role');
  });

  it('смена роли', async () => {
    const target = await seedUser(`usr_${stamp}_c`, 'viewer');
    const res = await request(app)
      .patch(`/users/${target.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'staff' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('staff');
  });

  it('удаление чужой учётки закрывает её сессии', async () => {
    const target = await seedUser(`usr_${stamp}_d`, 'staff');
    const targetCookie = await loginAs(target.login);

    const before = await request(app).get('/auth/me').set('Cookie', targetCookie);
    expect(before.body.user.login).toBe(target.login);

    const removed = await request(app).delete(`/users/${target.id}`).set('Cookie', adminCookie);
    expect(removed.status).toBe(204);

    const after = await request(app).get('/auth/me').set('Cookie', targetCookie);
    expect(after.body.user).toBeNull();
  });
});

describe('Защита от самоблокировки', () => {
  it('нельзя удалить собственную учётку', async () => {
    const me = await db('users').where({ login: adminLogin }).first();
    const res = await request(app).delete(`/users/${me.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SELF_DELETE');
  });

  it('нельзя снять права с самого себя', async () => {
    const me = await db('users').where({ login: adminLogin }).first();
    const res = await request(app)
      .patch(`/users/${me.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'staff' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SELF_DEMOTE');
  });
});
