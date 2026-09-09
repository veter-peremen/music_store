const { assertCanRestoreRecord, isArchived } = require('../src/domain/archive');

describe('Инвариант архива: пластинка не активна при архивном музыканте', () => {
  it('разрешает возврат, когда музыкант активен', () => {
    expect(() => assertCanRestoreRecord({ musicianArchivedAt: null })).not.toThrow();
  });

  it('запрещает возврат, когда музыкант в архиве', () => {
    expect(() => assertCanRestoreRecord({ musicianArchivedAt: '2026-09-09T10:00:00Z' })).toThrow(
      /музыкант в архиве/,
    );
  });

  it('отдаёт код MUSICIAN_ARCHIVED и статус 409', () => {
    try {
      assertCanRestoreRecord({ musicianArchivedAt: '2026-09-09T10:00:00Z' });
      throw new Error('ожидалась ошибка');
    } catch (err) {
      expect(err.code).toBe('MUSICIAN_ARCHIVED');
      expect(err.status).toBe(409);
    }
  });
});

describe('Определение архивности', () => {
  it('активная запись', () => {
    expect(isArchived({ archived_at: null })).toBe(false);
  });

  it('архивная запись', () => {
    expect(isArchived({ archived_at: '2026-09-09T10:00:00Z' })).toBe(true);
  });
});
