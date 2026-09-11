/**
 * Роли и их права.
 *
 * Ролей три, и у каждой права отличаются по существу:
 *   superadmin — управляет учётными записями, плюс всё, что может staff;
 *   staff      — меняет данные магазина: продажи, поступления, каталог;
 *   viewer     — только смотрит.
 *
 * Должности из ТЗ (продавец, кладовщик, управляющий) — это staff:
 * разделение прав между ними системе пока не нужно.
 */

const ROLES = Object.freeze(['superadmin', 'staff', 'viewer']);

const DEFAULT_ROLE = 'staff';

/** Может ли роль менять данные магазина. */
const canMutate = (role) => role === 'superadmin' || role === 'staff';

/** Может ли роль управлять учётными записями. */
const canManageUsers = (role) => role === 'superadmin';

const isKnownRole = (role) => ROLES.includes(role);

/**
 * Последний ли это суперадминистратор.
 *
 * Решение вынесено из маршрута, чтобы его можно было проверить тестом:
 * маршрут только считает, сколько суперадминистраторов в базе.
 */
const isLastSuperadmin = (role, superadminCount) =>
  role === 'superadmin' && Number(superadminCount) <= 1;

module.exports = {
  ROLES,
  DEFAULT_ROLE,
  canMutate,
  canManageUsers,
  isKnownRole,
  isLastSuperadmin,
};
