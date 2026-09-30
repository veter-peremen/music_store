const {
  ROLES,
  DEFAULT_ROLE,
  canMutate,
  canManageUsers,
  isKnownRole,
  isLastSuperadmin,
} = require('../src/domain/roles');

describe('Права ролей', () => {
  it('менять данные могут superadmin и staff, но не viewer', () => {
    expect(canMutate('superadmin')).toBe(true);
    expect(canMutate('staff')).toBe(true);
    expect(canMutate('viewer')).toBe(false);
  });

  it('управлять учётными записями может только superadmin', () => {
    expect(canManageUsers('superadmin')).toBe(true);
    expect(canManageUsers('staff')).toBe(false);
    expect(canManageUsers('viewer')).toBe(false);
  });

  it('неизвестная или пустая роль не даёт никаких прав', () => {
    for (const role of ['root', '', null, undefined, 'SUPERADMIN']) {
      expect(canMutate(role)).toBe(false);
      expect(canManageUsers(role)).toBe(false);
      expect(isKnownRole(role)).toBe(false);
    }
  });

  it('роль по умолчанию — наименьшие права: только просмотр', () => {
    expect(DEFAULT_ROLE).toBe('viewer');
    expect(canMutate(DEFAULT_ROLE)).toBe(false);
    expect(canManageUsers(DEFAULT_ROLE)).toBe(false);
  });

  it('роль по умолчанию входит в список известных', () => {
    expect(isKnownRole(DEFAULT_ROLE)).toBe(true);
    expect(ROLES).toContain(DEFAULT_ROLE);
  });
});

describe('Последний суперадминистратор', () => {
  it('единственный суперадминистратор считается последним', () => {
    expect(isLastSuperadmin('superadmin', 1)).toBe(true);
    expect(isLastSuperadmin('superadmin', '1')).toBe(true);
  });

  it('когда их несколько — нет', () => {
    expect(isLastSuperadmin('superadmin', 2)).toBe(false);
    expect(isLastSuperadmin('superadmin', 7)).toBe(false);
  });

  it('к остальным ролям правило не применяется', () => {
    expect(isLastSuperadmin('staff', 1)).toBe(false);
    expect(isLastSuperadmin('viewer', 0)).toBe(false);
  });

  it('ноль суперадминистраторов тоже считается пограничным случаем', () => {
    expect(isLastSuperadmin('superadmin', 0)).toBe(true);
  });
});
