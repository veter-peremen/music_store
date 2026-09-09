/** Оборачивает async-обработчик, чтобы отклонённые промисы уходили в errorHandler. */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
