const express = require('express');

const healthRouter = require('./routes/health');
const genresRouter = require('./routes/genres');
const musiciansRouter = require('./routes/musicians');
const recordsRouter = require('./routes/records');
const salesRouter = require('./routes/sales');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

/** Фабрика приложения: отделена от запуска сервера, чтобы её можно было тестировать. */
function createApp() {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/genres', genresRouter);
  app.use('/musicians', musiciansRouter);
  app.use('/records', recordsRouter);
  app.use('/sales', salesRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
