const { ConflictError, ValidationError } = require('../errors');

/** Переводит денежное значение (число или строка из PostgreSQL numeric) в копейки. */
function toCents(value) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) {
    throw new ValidationError('Цена должна быть числом');
  }
  return Math.round(num * 100);
}

/** Сумма продажи = цена x количество, без ошибок плавающей точки. */
function computeTotal(unitPrice, quantity) {
  assertPositiveQuantity(quantity);
  return ((toCents(unitPrice) * quantity) / 100).toFixed(2);
}

function assertPositiveQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError('Количество должно быть целым положительным числом');
  }
}

/** Движения запрещены по архивной пластинке (ТЗ §4.5). */
function assertNotArchived(record) {
  if (record.archived_at) {
    throw new ConflictError(
      'Пластинка находится в архиве: движения по ней запрещены',
      'RECORD_ARCHIVED',
    );
  }
}

/**
 * Ключевое правило предметной области (ТЗ §4.1):
 * нельзя продать больше, чем есть на остатке.
 */
function assertCanSell(record, quantity) {
  assertPositiveQuantity(quantity);
  assertNotArchived(record);
  if (quantity > record.stock) {
    throw new ConflictError(
      `Недостаточно остатка: доступно ${record.stock}, запрошено ${quantity}`,
      'INSUFFICIENT_STOCK',
    );
  }
}

function assertCanReceive(record, quantity) {
  assertPositiveQuantity(quantity);
  assertNotArchived(record);
}

const stockAfterSale = (stock, quantity) => stock - quantity;
const stockAfterReceipt = (stock, quantity) => stock + quantity;

module.exports = {
  toCents,
  computeTotal,
  assertPositiveQuantity,
  assertNotArchived,
  assertCanSell,
  assertCanReceive,
  stockAfterSale,
  stockAfterReceipt,
};
