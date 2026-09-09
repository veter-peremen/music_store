const { toCents } = require('./sales');

/**
 * Собирает отчёт «лидеры продаж» из агрегированных строк БД.
 *
 * Чистая функция: агрегацию и сортировку делает SQL, а доля позиции
 * в общей выручке считается здесь — в копейках, чтобы проценты
 * не разъезжались из-за плавающей точки.
 */
function buildTopSellersReport(rows) {
  const items = rows.map((row) => ({
    record_id: Number(row.record_id),
    title: row.title,
    musician: row.musician,
    genre: row.genre,
    archived: Boolean(row.archived_at),
    sales_count: Number(row.sales_count),
    total_quantity: Number(row.total_quantity),
    revenueCents: toCents(row.total_revenue),
  }));

  const revenueCents = items.reduce((sum, item) => sum + item.revenueCents, 0);
  const quantity = items.reduce((sum, item) => sum + item.total_quantity, 0);

  return {
    total_revenue: (revenueCents / 100).toFixed(2),
    total_quantity: quantity,
    positions: items.length,
    items: items.map(({ revenueCents: cents, ...rest }) => ({
      ...rest,
      revenue: (cents / 100).toFixed(2),
      revenue_share: revenueCents === 0 ? '0.0' : ((cents / revenueCents) * 100).toFixed(1),
    })),
  };
}

module.exports = { buildTopSellersReport };
