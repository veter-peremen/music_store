const express = require('express');
const { version } = require('../../package.json');

const router = express.Router();

/**
 * Корневой индекс API: что это за сервис и какие маршруты у него есть.
 * Плоский список — быстро читается глазами и легко копируется в curl.
 */
router.get('/', (_req, res) => {
  res.json({
    service: 'Музыкальный магазин — складской учёт винила',
    version,
    docs: 'docs/API.md',
    endpoints: [
      'GET /health',
      'GET /health/ready',
      'GET /genres',
      'GET /musicians',
      'GET /musicians/:id/genres',
      'GET /records',
      'GET /sales',
      'GET /reports/top-sellers',
    ],
  });
});

module.exports = router;
