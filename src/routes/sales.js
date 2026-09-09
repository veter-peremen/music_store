const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError } = require('../errors');
const { assertCanSell, computeTotal, stockAfterSale } = require('../domain/sales');
const { parse, saleCreate } = require('../validation/schemas');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await db('sales').orderBy('created_at', 'desc'));
  }),
);

/**
 * Продажа (ТЗ 4.1-4.4): в одной транзакции проверяем остаток,
 * фиксируем снимок цены и уменьшаем stock.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { record_id, quantity } = parse(saleCreate, req.body);

    const result = await db.transaction(async (trx) => {
      const record = await trx('records').where({ id: record_id }).forUpdate().first();
      if (!record) throw new NotFoundError(`Пластинка id=${record_id} не найдена`);

      assertCanSell(record, quantity);

      const unitPrice = record.price;
      const total = computeTotal(unitPrice, quantity);

      const [sale] = await trx('sales')
        .insert({ record_id, quantity, unit_price: unitPrice, total })
        .returning('*');
      const [updated] = await trx('records')
        .where({ id: record_id })
        .update({ stock: stockAfterSale(record.stock, quantity), updated_at: trx.fn.now() })
        .returning('*');

      return { sale, record: updated };
    });

    res.status(201).json(result);
  }),
);

module.exports = router;
