const { z } = require('zod');
const { ValidationError } = require('../errors');
const { ROLES, DEFAULT_ROLE } = require('../domain/roles');

/**
 * Приводит числовую строку к числу, а нечисловую оставляет строкой.
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
 */
const numeric = (field, refine = (schema) => schema) => {
  const baseSchema = z.any({
    required_error: `Поле «${field}» обязательно`,
    invalid_type_error: `Поле «${field}» должно быть числом`,
  }).transform((val, ctx) => {
    // undefined = поле не передано
    if (val === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» обязательно`,
      });
      return z.NEVER;
    }
    
    // null = передан неправильный тип
    if (val === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» должно быть числом`,
      });
      return z.NEVER;
    }
    
    // Приводим числовые строки
    const processed = toNumber(val);
    
    // Если не число после приведения
    if (typeof processed !== 'number' || Number.isNaN(processed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» должно быть числом`,
      });
      return z.NEVER;
    }
    
    return processed;
  });
  
  return refine(baseSchema);
};

/** Целый положительный идентификатор или количество. */
const positiveInt = (field) =>
  numeric(field, (schema) =>
    schema
      .refine((val) => Number.isInteger(val), {
        message: `Поле «${field}» должно быть целым числом`,
      })
      .refine((val) => val > 0, {
        message: `Поле «${field}» должно быть больше нуля`,
      }),
  );

const text = (field, max) =>
  z.any({
    required_error: `Поле «${field}» обязательно`,
    invalid_type_error: `Поле «${field}» должно быть строкой`,
  }).transform((val, ctx) => {
    // undefined = поле не передано
    if (val === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» обязательно`,
      });
      return z.NEVER;
    }
    
    // null = передан неправильный тип
    if (val === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» должно быть строкой`,
      });
      return z.NEVER;
    }
    
    if (typeof val !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» должно быть строкой`,
      });
      return z.NEVER;
    }
    
    const trimmed = val.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» не может быть пустым`,
      });
      return z.NEVER;
    }
    
    if (trimmed.length > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Поле «${field}» длиннее ${max} символов`,
      });
      return z.NEVER;
    }
    
    return trimmed;
  });

// ВАЖНО: эта строка должна быть здесь!
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
      .refine((val) => val > 0, 'Поле «price» должно быть больше нуля')
      .refine((val) => val <= 1_000_000, 'Поле «price» слишком велико'),
  ),
  year: numeric('year', (schema) =>
    schema
      .refine((val) => Number.isInteger(val), 'Поле «year» должно быть целым числом')
      .refine((val) => val >= 1900, 'Поле «year» не может быть раньше 1900')
      .refine((val) => val <= 2100, 'Поле «year» не может быть позже 2100'),
  )
    .optional()
    .nullable(),
  stock: numeric('stock', (schema) =>
    schema
      .refine((val) => Number.isInteger(val), 'Поле «stock» должно быть целым числом')
      .refine((val) => val >= 0, 'Поле «stock» не может быть отрицательным'),
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

const credentials = z.object({
  login: z
    .string({
      required_error: 'Поле «login» обязательно',
      invalid_type_error: 'Поле «login» должно быть строкой',
    })
    .trim()
    .min(3, 'Логин короче трёх символов')
    .max(32, 'Логин длиннее 32 символов')
    .regex(/^[A-Za-z0-9_-]+$/, 'В логине допустимы латинские буквы, цифры, дефис и подчёркивание'),
  password: z
    .string({
      required_error: 'Поле «password» обязательно',
      invalid_type_error: 'Поле «password» должно быть строкой',
    })
    .min(8, 'Пароль короче восьми символов')
    .max(200, 'Пароль длиннее 200 символов'),
});

const roleField = z.enum(ROLES, {
  errorMap: () => ({ message: `Роль должна быть одной из: ${ROLES.join(', ')}` }),
});

const userCreate = credentials.extend({ role: roleField.default(DEFAULT_ROLE) });
const userUpdate = z.object({ role: roleField });

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
      .refine((val) => Number.isInteger(val), 'Поле «limit» должно быть целым числом')
      .refine((val) => val > 0, 'Поле «limit» должно быть больше нуля')
      .refine((val) => val <= 100, 'Поле «limit» не может превышать 100'),
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
  credentials,
  userCreate,
  userUpdate,
};
