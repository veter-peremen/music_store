exports.up = async (knex) => {
  await knex.schema.alterTable('genres', (table) => {
    table.text('comment').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('genres', (table) => {
    table.dropColumn('comment');
  });
};
