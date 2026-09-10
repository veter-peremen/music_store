const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ConflictError } = require('../errors');
const {
  parse,
  idParam,
  musicianCreate,
  musicianUpdate,
  musicianListQuery,
} = require('../validation/schemas');

const router = express.Router();

const findMusician = async (id, trx = db) => {
  const musician = await trx('musicians').where({ id }).first();
  if (!musician) throw new NotFoundError(`Музыкант id=${id} не найден`);
  return musician;
};

const applyArchivedFilter = (query, archived) => {
  if (archived === 'false') return query.whereNull('archived_at');
  if (archived === 'true') return query.whereNotNull('archived_at');
  return query;
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { archived } = parse(musicianListQuery, req.query);
    res.json(await applyArchivedFilter(db('musicians'), archived).orderBy('name'));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await findMusician(parse(idParam, req.params.id)));
  }),
);

/** Жанры музыканта — вычисляются из его пластинок, не хранятся (ТЗ §4). */
router.get(
  '/:id/genres',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await findMusician(id);
    const genres = await db('genres')
      .distinct('genres.id', 'genres.name')
      .join('records', 'records.genre_id', 'genres.id')
      .where('records.musician_id', id)
      .orderBy('genres.name');
    res.json(genres);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(musicianCreate, req.body);
    const [musician] = await db('musicians').insert(data).returning('*');
    res.status(201).json(musician);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await findMusician(id);
    const data = parse(musicianUpdate, req.body);
    const [musician] = await db('musicians')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    res.json(musician);
  }),
);

/** Архивация музыканта каскадно архивирует его пластинки (ТЗ §5.5). */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const result = await db.transaction(async (trx) => {
      const musician = await findMusician(id, trx);
      if (musician.archived_at) {
        throw new ConflictError('Музыкант уже в архиве', 'ALREADY_ARCHIVED');
      }
      const now = trx.fn.now();
      const archivedRecords = await trx('records')
        .where({ musician_id: id })
        .whereNull('archived_at')
        .update({ archived_at: now, updated_at: now })
        .returning('id');
      const [updated] = await trx('musicians')
        .where({ id })
        .update({ archived_at: now, updated_at: now })
        .returning('*');
      return { musician: updated, archived_records: archivedRecords.map((r) => r.id) };
    });
    res.json(result);
  }),
);

/** Возврат из архива: только сам музыкант, пластинки восстанавливаются отдельно (ТЗ §5.5). */
router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const musician = await findMusician(id);
    if (!musician.archived_at) {
      throw new ConflictError('Музыкант не находится в архиве', 'NOT_ARCHIVED');
    }
    const [restored] = await db('musicians')
      .where({ id })
      .update({ archived_at: null, updated_at: db.fn.now() })
      .returning('*');
    res.json(restored);
  }),
);

module.exports = router;
