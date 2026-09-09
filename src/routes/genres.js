const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ConflictError } = require('../errors');
const { parse, idParam, genreCreate, genreUpdate } = require('../validation/schemas');

const router = express.Router();

const findGenre = async (id) => {
  const genre = await db('genres').where({ id }).first();
  if (!genre) throw new NotFoundError(`Жанр id=${id} не найден`);
  return genre;
};

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await db('genres').orderBy('name'));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await findGenre(parse(idParam, req.params.id)));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(genreCreate, req.body);
    const [genre] = await db('genres').insert(data).returning('*');
    res.status(201).json(genre);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await findGenre(id);
    const data = parse(genreUpdate, req.body);
    const [genre] = await db('genres')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    res.json(genre);
  }),
);

/** Жанр удаляется физически, но только если на него не ссылаются пластинки (ТЗ §4.5). */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await findGenre(id);
    const [{ count }] = await db('records').where({ genre_id: id }).count({ count: '*' });
    if (Number(count) > 0) {
      throw new ConflictError(
        `Нельзя удалить жанр: на него ссылаются пластинки (${count} шт.)`,
        'GENRE_IN_USE',
      );
    }
    await db('genres').where({ id }).del();
    res.status(204).end();
  }),
);

module.exports = router;
