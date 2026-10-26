exports.up = async (knex) => {
  await knex.schema.alterTable('musicians', (table) => {
    table.text('comment').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('musicians', (table) => {
    table.dropColumn('comment');
  });
};
