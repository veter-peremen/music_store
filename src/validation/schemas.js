const { z } = require('zod');
const { ValidationError } = require('../errors');

const idParam = z.coerce.number().int().positive();
const quantity = z.coerce.number().int().positive();
const price = z.coerce.number().positive().max(1_000_000);
const name = z.string().trim().min(1).max(200);

const genreCreate = z.object({ name: name.max(120) });
const genreUpdate = genreCreate.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Нужно передать хотя бы одно поле',
});

const musicianCreate = z.object({
  name,
  country: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
const musicianUpdate = musicianCreate.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Нужно передать хотя бы одно поле',
});

const recordCreate = z.object({
  title: name,
  musician_id: idParam,
  genre_id: idParam,
  price,
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  stock: z.coerce.number().int().min(0).optional(),
});
const recordUpdate = recordCreate.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Нужно передать хотя бы одно поле',
});

const saleCreate = z.object({ record_id: idParam, quantity });
const receiptCreate = z.object({ quantity });

const archivedFilter = z.enum(['false', 'true', 'all']).default('false');
const recordListQuery = z.object({
  musician_id: idParam.optional(),
  genre_id: idParam.optional(),
  archived: archivedFilter,
});
const musicianListQuery = z.object({ archived: archivedFilter });
const topSellersQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(10),
});

/** Разбирает данные схемой и превращает ошибку zod в ValidationError (HTTP 400). */
function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.') || '(корень)',
      message: i.message,
    }));
    throw new ValidationError('Некорректные данные запроса', details);
  }
  return result.data;
}

module.exports = {
  parse,
  idParam,
  genreCreate,
  genreUpdate,
  musicianCreate,
  musicianUpdate,
  recordCreate,
  recordUpdate,
  saleCreate,
  receiptCreate,
  recordListQuery,
  musicianListQuery,
  topSellersQuery,
};
