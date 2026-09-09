const { buildTopSellersReport } = require('../src/domain/reports');

const row = (overrides = {}) => ({
  record_id: 1,
  title: 'Kind of Blue',
  musician: 'Miles Davis',
  genre: 'Jazz',
  archived_at: null,
  sales_count: '2',
  total_quantity: '5',
  total_revenue: '19500.00',
  ...overrides,
});

describe('Отчёт «лидеры продаж»', () => {
  it('приводит строковые агрегаты PostgreSQL к числам', () => {
    const report = buildTopSellersReport([row()]);
    expect(report.items[0].total_quantity).toBe(5);
    expect(report.items[0].sales_count).toBe(2);
    expect(report.items[0].revenue).toBe('19500.00');
  });

  it('считает итоги по всем позициям', () => {
    const report = buildTopSellersReport([
      row({ record_id: 1, total_quantity: '5', total_revenue: '19500.00' }),
      row({ record_id: 2, title: 'Autobahn', total_quantity: '3', total_revenue: '10800.00' }),
    ]);
    expect(report.positions).toBe(2);
    expect(report.total_quantity).toBe(8);
    expect(report.total_revenue).toBe('30300.00');
  });

  it('считает долю позиции в выручке', () => {
    const report = buildTopSellersReport([
      row({ record_id: 1, total_revenue: '7500.00' }),
      row({ record_id: 2, total_revenue: '2500.00' }),
    ]);
    expect(report.items[0].revenue_share).toBe('75.0');
    expect(report.items[1].revenue_share).toBe('25.0');
  });

  it('доли округляются независимо и расходятся с 100% не более чем на 0.5', () => {
    const report = buildTopSellersReport([
      row({ record_id: 1, total_revenue: '3333.33' }),
      row({ record_id: 2, total_revenue: '3333.33' }),
      row({ record_id: 3, total_revenue: '3333.34' }),
    ]);
    expect(report.items.map((i) => i.revenue_share)).toEqual(['33.3', '33.3', '33.3']);
    const sum = report.items.reduce((acc, i) => acc + Number(i.revenue_share), 0);
    expect(Math.abs(100 - sum)).toBeLessThanOrEqual(0.5);
  });

  it('помечает архивные пластинки, но не выбрасывает их из истории', () => {
    const report = buildTopSellersReport([
      row({ archived_at: '2026-09-09T10:00:00Z' }),
      row({ record_id: 2, archived_at: null }),
    ]);
    expect(report.items[0].archived).toBe(true);
    expect(report.items[1].archived).toBe(false);
  });

  it('не делит на ноль, когда продаж не было', () => {
    const report = buildTopSellersReport([]);
    expect(report).toEqual({ total_revenue: '0.00', total_quantity: 0, positions: 0, items: [] });
  });
});
