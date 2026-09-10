const { z } = require('zod');
const { ValidationError } = require('../errors');

/**
 * Приводит числовую строку к числу, а нечисловую оставляет строкой.
 *
 * Мусор намеренно не превращается в NaN: пусть до проверки типа дойдёт
 * строка, тогда zod скажет «должно быть числом», а не «received nan».
 */
const toNumber = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return value;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? value : parsed;
};

/**
 * Числовое поле, различающее «не передано» и «передан мусор».
 *
 * z.coerce.number() прогоняет через Number() даже undefined, получает NaN
 * и рапортует «Expected number, received nan» — по такому сообщению нельзя
 * понять, что поле просто забыли. Здесь наличие проверяется до приведения.
 */
const numeric = (field, refine = (schema) => schema) =>
  z.preprocess(
    toNumber,
    refine(
      z.number({
        required_error: `Поле «${field}» обязательно`,
        invalid_type_error: `Поле «${field}» должно быть числом`,
      }),
    ),
  );

/** Целый положительный идентификатор или количество. */
const positiveInt = (field) =>
  numeric(field, (schema) =>
    schema
      .int(`Поле «${field}» должно быть целым числом`)
      .positive(`Поле «${field}» должно быть больше нуля`),
  );

const text = (field, max) =>
  z
    .string({
      required_error: `Поле «${field}» обязательно`,
      invalid_type_error: `Поле «${field}» должно быть строкой`,
    })
    .trim()
    .min(1, `Поле «${field}» не может быть пустым`)
    .max(max, `Поле «${field}» длиннее ${max} символов`);

const idParam = positiveInt('id');

const genreCreate = z.object({ name: text('name', 120) });
const genreUpdate = genreCreate.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Нужно передать хотя бы одно поле',
});

const musicianCreate = z.object({
  name: text('name', 200),
  country: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
const musicianUpdate = musicianCreate.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Нужно передать хотя бы одно поле',
});

const recordCreate = z.object({
  title: text('title', 200),
  musician_id: positiveInt('musician_id'),
  genre_id: positiveInt('genre_id'),
  price: numeric('price', (schema) =>
    schema
      .positive('Поле «price» должно быть больше нуля')
      .max(1_000_000, 'Поле «price» слишком велико'),
  ),
  year: numeric('year', (schema) =>
    schema
      .int('Поле «year» должно быть целым числом')
      .min(1900, 'Поле «year» не может быть раньше 1900')
      .max(2100, 'Поле «year» не может быть позже 2100'),
  )
    .optional()
    .nullable(),
  stock: numeric('stock', (schema) =>
    schema
      .int('Поле «stock» должно быть целым числом')
      .min(0, 'Поле «stock» не может быть отрицательным'),
  ).optional(),
});
const recordUpdate = recordCreate.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Нужно передать хотя бы одно поле',
});

const saleCreate = z.object({
  record_id: positiveInt('record_id'),
  quantity: positiveInt('quantity'),
});
const receiptCreate = z.object({ quantity: positiveInt('quantity') });

const archivedFilter = z.enum(['false', 'true', 'all']).default('false');
const recordListQuery = z.object({
  musician_id: positiveInt('musician_id').optional(),
  genre_id: positiveInt('genre_id').optional(),
  archived: archivedFilter,
});
const musicianListQuery = z.object({ archived: archivedFilter });
const topSellersQuery = z.object({
  limit: numeric('limit', (schema) =>
    schema
      .int('Поле «limit» должно быть целым числом')
      .positive('Поле «limit» должно быть больше нуля')
      .max(100, 'Поле «limit» не может превышать 100'),
  ).default(10),
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
