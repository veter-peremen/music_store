const { hashPassword, verifyPassword } = require('../src/domain/password');

describe('Хранение паролей', () => {
  it('не хранит пароль в открытом виде', async () => {
    const stored = await hashPassword('корректная-лошадь-батарейка');
    expect(stored).not.toContain('корректная-лошадь-батарейка');
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('принимает верный пароль', async () => {
    const stored = await hashPassword('s3cret-pass');
    await expect(verifyPassword('s3cret-pass', stored)).resolves.toBe(true);
  });

  it('отклоняет неверный пароль', async () => {
    const stored = await hashPassword('s3cret-pass');
    await expect(verifyPassword('s3cret-pasS', stored)).resolves.toBe(false);
  });

  it('даёт разные хеши для одинаковых паролей', async () => {
    const [first, second] = await Promise.all([
      hashPassword('одинаковый'),
      hashPassword('одинаковый'),
    ]);
    expect(first).not.toBe(second);
    await expect(verifyPassword('одинаковый', first)).resolves.toBe(true);
    await expect(verifyPassword('одинаковый', second)).resolves.toBe(true);
  });

  it('не падает на испорченном или пустом хеше', async () => {
    await expect(verifyPassword('любой', 'мусор')).resolves.toBe(false);
    await expect(verifyPassword('любой', '')).resolves.toBe(false);
    await expect(verifyPassword('любой', null)).resolves.toBe(false);
    await expect(verifyPassword('любой', 'scrypt$zz$zz')).resolves.toBe(false);
  });
});
