exports.up = async (knex) => {
  await knex.schema.alterTable('records', (table) => {
    table.text('comment').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('records', (table) => {
    table.dropColumn('comment');
  });
};
