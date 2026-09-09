const {
  computeTotal,
  assertCanSell,
  assertCanReceive,
  assertPositiveQuantity,
  stockAfterSale,
  stockAfterReceipt,
  toCents,
} = require('../src/domain/sales');

const activeRecord = (overrides = {}) => ({
  id: 1,
  title: 'Kind of Blue',
  price: '3900.00',
  stock: 5,
  archived_at: null,
  ...overrides,
});

describe('Расчёт суммы продажи', () => {
  it('умножает цену на количество', () => {
    expect(computeTotal('3900.00', 2)).toBe('7800.00');
  });

  it('корректно считает копейки без ошибок плавающей точки', () => {
    expect(computeTotal('0.10', 3)).toBe('0.30');
    expect(computeTotal('1999.99', 3)).toBe('5999.97');
  });

  it('принимает цену числом и строкой одинаково', () => {
    expect(computeTotal(1500.5, 2)).toBe(computeTotal('1500.50', 2));
  });

  it('переводит рубли в копейки', () => {
    expect(toCents('12.34')).toBe(1234);
  });
});

describe('Проверка количества', () => {
  it.each([0, -1, 1.5, NaN, '2'])('отклоняет некорректное количество: %p', (bad) => {
    expect(() => assertPositiveQuantity(bad)).toThrow(/целым положительным/);
  });

  it('принимает целое положительное', () => {
    expect(() => assertPositiveQuantity(3)).not.toThrow();
  });
});

describe('Ключевое правило: нельзя продать больше, чем на остатке', () => {
  it('разрешает продажу в пределах остатка', () => {
    expect(() => assertCanSell(activeRecord({ stock: 5 }), 5)).not.toThrow();
  });

  it('запрещает продажу сверх остатка', () => {
    expect(() => assertCanSell(activeRecord({ stock: 3 }), 4)).toThrow(/Недостаточно остатка/);
  });

  it('отдаёт код INSUFFICIENT_STOCK и статус 409', () => {
    try {
      assertCanSell(activeRecord({ stock: 1 }), 2);
      throw new Error('ожидалась ошибка');
    } catch (err) {
      expect(err.code).toBe('INSUFFICIENT_STOCK');
      expect(err.status).toBe(409);
    }
  });

  it('запрещает продажу при нулевом остатке', () => {
    expect(() => assertCanSell(activeRecord({ stock: 0 }), 1)).toThrow(/Недостаточно остатка/);
  });
});

describe('Архивная пластинка не участвует в движениях', () => {
  const archived = activeRecord({ archived_at: '2026-09-09T10:00:00Z', stock: 10 });

  it('нельзя продать', () => {
    expect(() => assertCanSell(archived, 1)).toThrow(/архиве/);
  });

  it('нельзя оприходовать', () => {
    expect(() => assertCanReceive(archived, 1)).toThrow(/архиве/);
  });

  it('отдаёт код RECORD_ARCHIVED', () => {
    try {
      assertCanSell(archived, 1);
      throw new Error('ожидалась ошибка');
    } catch (err) {
      expect(err.code).toBe('RECORD_ARCHIVED');
    }
  });
});

describe('Пересчёт остатка', () => {
  it('продажа уменьшает остаток', () => {
    expect(stockAfterSale(10, 3)).toBe(7);
  });

  it('поступление увеличивает остаток', () => {
    expect(stockAfterReceipt(10, 3)).toBe(13);
  });
});
