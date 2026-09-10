const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ConflictError } = require('../errors');
const { assertCanReceive, stockAfterReceipt } = require('../domain/sales');
const { assertCanRestoreRecord } = require('../domain/archive');
const schemas = require('../validation/schemas');

const { parse, idParam } = schemas;
const router = express.Router();

const findRecord = async (id, trx = db) => {
  const record = await trx('records').where({ id }).first();
  if (!record) throw new NotFoundError(`Пластинка id=${id} не найдена`);
  return record;
};

/** Проверяет, что музыкант и жанр существуют, а музыкант не в архиве. */
const assertRefsExist = async (data) => {
  if (data.musician_id !== undefined) {
    const musician = await db('musicians').where({ id: data.musician_id }).first();
    if (!musician) throw new NotFoundError(`Музыкант id=${data.musician_id} не найден`);
    if (musician.archived_at) {
      throw new ConflictError(
        'Нельзя привязать пластинку к музыканту из архива',
        'MUSICIAN_ARCHIVED',
      );
    }
  }
  if (data.genre_id !== undefined) {
    const genre = await db('genres').where({ id: data.genre_id }).first();
    if (!genre) throw new NotFoundError(`Жанр id=${data.genre_id} не найден`);
  }
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(schemas.recordListQuery, req.query);
    let query = db('records');
    if (q.archived === 'false') query = query.whereNull('archived_at');
    if (q.archived === 'true') query = query.whereNotNull('archived_at');
    if (q.musician_id) query = query.where({ musician_id: q.musician_id });
    if (q.genre_id) query = query.where({ genre_id: q.genre_id });
    res.json(await query.orderBy('title'));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await findRecord(parse(idParam, req.params.id)));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(schemas.recordCreate, req.body);
    await assertRefsExist(data);
    const [record] = await db('records').insert(data).returning('*');
    res.status(201).json(record);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await findRecord(id);
    const data = parse(schemas.recordUpdate, req.body);
    await assertRefsExist(data);
    const [record] = await db('records')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    res.json(record);
  }),
);
/** Архивация пластинки - мягкое удаление из каталога (ТЗ §5.5). */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const record = await findRecord(id);
    if (record.archived_at) {
      throw new ConflictError('Пластинка уже в архиве', 'ALREADY_ARCHIVED');
    }
    const [archived] = await db('records')
      .where({ id })
      .update({ archived_at: db.fn.now(), updated_at: db.fn.now() })
      .returning('*');
    res.json(archived);
  }),
);

/** Возврат из архива. Инвариант: музыкант пластинки должен быть активен (ТЗ §5.5). */
router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const record = await findRecord(id);
    if (!record.archived_at) {
      throw new ConflictError('Пластинка не находится в архиве', 'NOT_ARCHIVED');
    }
    const musician = await db('musicians').where({ id: record.musician_id }).first();
    assertCanRestoreRecord({ musicianArchivedAt: musician.archived_at });
    const [restored] = await db('records')
      .where({ id })
      .update({ archived_at: null, updated_at: db.fn.now() })
      .returning('*');
    res.json(restored);
  }),
);

/** Поступление: атомарно увеличивает остаток (ТЗ §5.2, §5.4). */
router.post(
  '/:id/receipts',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { quantity } = parse(schemas.receiptCreate, req.body);

    const result = await db.transaction(async (trx) => {
      const record = await trx('records').where({ id }).forUpdate().first();
      if (!record) throw new NotFoundError(`Пластинка id=${id} не найдена`);
      assertCanReceive(record, quantity);

      const [receipt] = await trx('receipts').insert({ record_id: id, quantity }).returning('*');
      const [updated] = await trx('records')
        .where({ id })
        .update({ stock: stockAfterReceipt(record.stock, quantity), updated_at: trx.fn.now() })
        .returning('*');
      return { receipt, record: updated };
    });

    res.status(201).json(result);
  }),
);

router.get(
  '/:id/receipts',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await findRecord(id);
    res.json(await db('receipts').where({ record_id: id }).orderBy('created_at', 'desc'));
  }),
);

module.exports = router;
