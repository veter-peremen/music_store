if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    'ОШИБКА: NODE_ENV не равен "test"! ' +
    'Тесты не могут запускаться в production/development окружении. ' +
    'Используйте: NODE_ENV=test npm test'
  );
}


const dbName = process.env.DB_NAME || '';
if (!dbName.includes('test')) {
  throw new Error(
    `ОШИБКА: База данных "${dbName}" не является тестовой! ` +
    'Установите DB_NAME=music_store_test в .env.test'
  );
}

// если база данных не тестовая, тесты не выполняются
jest.setTimeout(10000);

console.log(`✅ Тестовое окружение подтверждено: NODE_ENV=${process.env.NODE_ENV}, DB=${dbName}`);
