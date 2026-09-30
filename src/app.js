const path = require('path');

const express = require('express');

const rootRouter = require('./routes/root');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const healthRouter = require('./routes/health');
const genresRouter = require('./routes/genres');
const musiciansRouter = require('./routes/musicians');
const recordsRouter = require('./routes/records');
const salesRouter = require('./routes/sales');
const reportsRouter = require('./routes/reports');
const { attachUser, requireAccess, requireUserManager } = require('./middleware/auth');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

/** Фабрика приложения: отделена от запуска сервера, чтобы её можно было тестировать. */
function createApp() {
  const app = express();

  app.use(express.json());

  // Опознаём пользователя до маршрутов — дальше он доступен как req.user.
  app.use(attachUser);

  app.use('/api', rootRouter);
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);

  // Страница интерфейса, стили и скрипт отдаются без входа: иначе форма
  // входа сама оказалась бы за 401. Данных в этих файлах нет — всё
  // содержимое приходит из API, а API закрыт ниже. Статика отдаёт только
  // существующие файлы и пропускает остальные запросы дальше, поэтому
  // маршруты API она не перехватывает.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Всё, что ниже, — данные магазина: без входа недоступны ни на чтение,
  // ни на запись. Вход, регистрация и проверки живости подключены выше.
  app.use(requireAccess);

  // Управление учётными записями закрыто целиком, включая чтение списка.
  app.use('/users', requireUserManager, usersRouter);

  app.use('/genres', genresRouter);
  app.use('/musicians', musiciansRouter);
  app.use('/records', recordsRouter);
  app.use('/sales', salesRouter);
  app.use('/reports', reportsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
