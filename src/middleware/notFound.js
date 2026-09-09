const { NotFoundError } = require('../errors');

module.exports = (req, _res, next) => {
  next(new NotFoundError(`Маршрут ${req.method} ${req.originalUrl} не найден`));
};
