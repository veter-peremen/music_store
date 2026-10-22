// Отдельная конфигурация для тестов

process.env.NODE_ENV = 'test';

if (!process.env.TEST_DB_NAME) {
  console.warn('⚠️  WARNING: TEST_DB_NAME не установлена. Используйте базу music_store_test');
}

jest.setTimeout(10000); // 10 секунд на тест

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
