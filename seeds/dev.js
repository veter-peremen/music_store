/** Демонстрационные данные для локальной разработки. */
exports.seed = async (knex) => {
  await knex('sales').del();
  await knex('receipts').del();
  await knex('records').del();
  await knex('musicians').del();
  await knex('genres').del();

  const genres = await knex('genres')
    .insert([{ name: 'Rock' }, { name: 'Jazz' }, { name: 'Electronic' }])
    .returning(['id', 'name']);
  const genreId = Object.fromEntries(genres.map((g) => [g.name, g.id]));

  const musicians = await knex('musicians')
    .insert([
      { name: 'Pink Floyd', country: 'Великобритания' },
      { name: 'Miles Davis', country: 'США' },
      { name: 'Kraftwerk', country: 'Германия' },
    ])
    .returning(['id', 'name']);
  const musicianId = Object.fromEntries(musicians.map((m) => [m.name, m.id]));

  await knex('records').insert([
    {
      title: 'The Dark Side of the Moon',
      musician_id: musicianId['Pink Floyd'],
      genre_id: genreId.Rock,
      price: '4500.00',
      stock: 10,
      year: 1973,
    },
    {
      title: 'Wish You Were Here',
      musician_id: musicianId['Pink Floyd'],
      genre_id: genreId.Rock,
      price: '4200.00',
      stock: 4,
      year: 1975,
    },
    {
      title: 'Kind of Blue',
      musician_id: musicianId['Miles Davis'],
      genre_id: genreId.Jazz,
      price: '3900.00',
      stock: 7,
      year: 1959,
    },
    {
      title: 'Autobahn',
      musician_id: musicianId.Kraftwerk,
      genre_id: genreId.Electronic,
      price: '3600.00',
      stock: 0,
      year: 1974,
    },
  ]);
};
