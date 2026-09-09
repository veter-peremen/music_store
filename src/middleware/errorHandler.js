const { AppError } = require('../errors');

/** Единый формат ошибки: { error: { code, message, details? } }. */
module.exports = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Нарушение уникальности на уровне PostgreSQL -> конфликт, а не 500.
  if (err && err.code === '23505') {
    return res.status(409).json({
      error: { code: 'DUPLICATE', message: 'Запись с таким значением уже существует' },
    });
  }

  console.error('Необработанная ошибка:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' },
  });
};
