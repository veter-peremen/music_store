const { ConflictError } = require('../errors');

/**
 * Инвариант ТЗ §4.5: пластинка не может быть активна,
 * если её музыкант находится в архиве.
 */
function assertCanRestoreRecord({ musicianArchivedAt }) {
  if (musicianArchivedAt) {
    throw new ConflictError(
      'Нельзя вернуть пластинку из архива: её музыкант в архиве. Сначала восстановите музыканта',
      'MUSICIAN_ARCHIVED',
    );
  }
}

const isArchived = (entity) => Boolean(entity && entity.archived_at);

module.exports = { assertCanRestoreRecord, isArchived };
