/** Базовая ошибка приложения: несёт HTTP-статус и машиночитаемый код. */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Некорректные данные запроса', details) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ресурс не найден', details) {
    super(404, 'NOT_FOUND', message, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Нарушено правило предметной области', code = 'CONFLICT', details) {
    super(409, code, message, details);
  }
}

module.exports = { AppError, ValidationError, NotFoundError, ConflictError };
