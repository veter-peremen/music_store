const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { buildTopSellersReport } = require('../domain/reports');
const { parse, topSellersQuery } = require('../validation/schemas');

const router = express.Router();

/**
 * Лидеры продаж: агрегируем историю продаж по пластинкам.
 *
 * Архивные пластинки остаются в отчёте (история продаж неуничтожима,
 * ТЗ §4.5) и помечаются флагом archived.
 */
router.get(
  '/top-sellers',
  asyncHandler(async (req, res) => {
    const { limit } = parse(topSellersQuery, req.query);

    const rows = await db('sales')
      .join('records', 'records.id', 'sales.record_id')
      .join('musicians', 'musicians.id', 'records.musician_id')
      .join('genres', 'genres.id', 'records.genre_id')
      .select({
        record_id: 'records.id',
        title: 'records.title',
        archived_at: 'records.archived_at',
        musician: 'musicians.name',
        genre: 'genres.name',
      })
      .count({ sales_count: 'sales.id' })
      .sum({ total_quantity: 'sales.quantity' })
      .sum({ total_revenue: 'sales.total' })
      .groupBy(
        'records.id',
        'records.title',
        'records.archived_at',
        'musicians.name',
        'genres.name',
      )
      .orderByRaw('sum(sales.quantity) desc, sum(sales.total) desc, records.title asc')
      .limit(limit);

    res.json(buildTopSellersReport(rows));
  }),
);

module.exports = router;
