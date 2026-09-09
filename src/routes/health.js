const express = require('express');
const db = require('../db');

const router = express.Router();

/** Живость процесса — без обращения к БД (ТЗ §6). */
router.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

/** Готовность — с проверкой соединения с БД. */
router.get('/ready', async (_req, res) => {
  try {
    await db.raw('select 1');
    res.json({ status: 'ready', db: 'up' });
  } catch {
    res.status(503).json({ status: 'not_ready', db: 'down' });
  }
});

module.exports = router;
