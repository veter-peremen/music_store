/**
 * Начальная схема «Музыкальный магазин» (ТЗ §4, §8).
 * Все внешние ключи RESTRICT: музыканты и пластинки не удаляются физически,
 * а уходят в архив (archived_at), поэтому история движений неуничтожима.
 */

const timestamps = (knex, table) => {
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
};

exports.up = async (knex) => {
  await knex.schema.createTable('genres', (t) => {
    t.increments('id').primary();
    t.string('name', 120).notNullable().unique();
    timestamps(knex, t);
  });

  await knex.schema.createTable('musicians', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable();
    t.string('country', 100).nullable();
    t.text('notes').nullable();
    t.timestamp('archived_at', { useTz: true }).nullable();
    timestamps(knex, t);
    t.index('archived_at', 'musicians_archived_at_idx');
  });

  await knex.schema.createTable('records', (t) => {
    t.increments('id').primary();
    t.string('title', 200).notNullable();
    t.integer('musician_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('musicians')
      .onDelete('RESTRICT');
    t.integer('genre_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('genres')
      .onDelete('RESTRICT');
    t.decimal('price', 12, 2).notNullable();
    t.integer('stock').notNullable().defaultTo(0);
    t.integer('year').nullable();
    t.timestamp('archived_at', { useTz: true }).nullable();
    timestamps(knex, t);
    t.index('musician_id', 'records_musician_id_idx');
    t.index('genre_id', 'records_genre_id_idx');
    t.index('archived_at', 'records_archived_at_idx');
  });
  await knex.raw('ALTER TABLE records ADD CONSTRAINT records_price_positive CHECK (price > 0)');
  await knex.raw(
    'ALTER TABLE records ADD CONSTRAINT records_stock_non_negative CHECK (stock >= 0)',
  );

  await knex.schema.createTable('receipts', (t) => {
    t.increments('id').primary();
    t.integer('record_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('records')
      .onDelete('RESTRICT');
    t.integer('quantity').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('record_id', 'receipts_record_id_idx');
  });
  await knex.raw(
    'ALTER TABLE receipts ADD CONSTRAINT receipts_quantity_positive CHECK (quantity > 0)',
  );

  await knex.schema.createTable('sales', (t) => {
    t.increments('id').primary();
    t.integer('record_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('records')
      .onDelete('RESTRICT');
    t.integer('quantity').notNullable();
    t.decimal('unit_price', 12, 2).notNullable();
    t.decimal('total', 12, 2).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('record_id', 'sales_record_id_idx');
  });
  await knex.raw('ALTER TABLE sales ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0)');
  await knex.raw(
    'ALTER TABLE sales ADD CONSTRAINT sales_unit_price_positive CHECK (unit_price > 0)',
  );
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('sales');
  await knex.schema.dropTableIfExists('receipts');
  await knex.schema.dropTableIfExists('records');
  await knex.schema.dropTableIfExists('musicians');
  await knex.schema.dropTableIfExists('genres');
};
