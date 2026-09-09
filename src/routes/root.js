const express = require('express');
const { version, description } = require('../../package.json');

const router = express.Router();

/**
 * Корневой индекс API: что это за сервис и какие маршруты у него есть.
 * Маршруты сгруппированы по ресурсам — видно структуру предметной области.
 */
router.get('/', (_req, res) => {
  res.json({
    name: 'music-store',
    description,
    version,
    docs: 'docs/API.md',
    resources: {
      health: ['GET /health', 'GET /health/ready'],
      genres: ['GET /genres', 'POST /genres', 'PATCH /genres/:id', 'DELETE /genres/:id'],
      musicians: [
        'GET /musicians',
        'POST /musicians',
        'PATCH /musicians/:id',
        'DELETE /musicians/:id',
        'POST /musicians/:id/restore',
        'GET /musicians/:id/genres',
      ],
      records: [
        'GET /records',
        'POST /records',
        'PATCH /records/:id',
        'DELETE /records/:id',
        'POST /records/:id/restore',
        'POST /records/:id/receipts',
      ],
      sales: ['GET /sales', 'POST /sales'],
      reports: ['GET /reports/top-sellers'],
    },
  });
});

module.exports = router;
