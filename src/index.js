const createApp = require('./app');
const config = require('./config');
const db = require('./db');

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Музыкальный магазин слушает порт ${config.port} (окружение: ${config.env})`);
});

const shutdown = (signal) => () => {
  console.log(`Получен ${signal}, останавливаюсь...`);
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown('SIGINT'));
process.on('SIGTERM', shutdown('SIGTERM'));
