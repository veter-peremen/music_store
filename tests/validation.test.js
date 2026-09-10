const {
  parse,
  saleCreate,
  recordCreate,
  genreCreate,
  idParam,
} = require('../src/validation/schemas');

/** Возвращает сообщение об ошибке для указанного поля. */
const messageFor = (schema, data, field) => {
  try {
    parse(schema, data);
    return null;
  } catch (err) {
    const detail = err.details.find((d) => d.field === field);
    return detail ? detail.message : null;
  }
};

describe('Различение «поле не передано» и «передан мусор»', () => {
  it('пропущенное поле сообщает, что оно обязательно', () => {
    expect(messageFor(saleCreate, {}, 'record_id')).toBe('Поле «record_id» обязательно');
    expect(messageFor(saleCreate, {}, 'quantity')).toBe('Поле «quantity» обязательно');
  });

  it('нечисловая строка сообщает про тип, а не про nan', () => {
    const message = messageFor(saleCreate, { record_id: 'абвгд', quantity: 1 }, 'record_id');
    expect(message).toBe('Поле «record_id» должно быть числом');
    expect(message).not.toMatch(/nan/i);
  });

  it('null тоже не превращается в загадочный nan', () => {
    expect(messageFor(saleCreate, { record_id: null, quantity: 1 }, 'record_id')).toBe(
      'Поле «record_id» должно быть числом',
    );
  });
});

describe('Числовые строки принимаются', () => {
  it('строка из параметра пути приводится к числу', () => {
    expect(parse(idParam, '42')).toBe(42);
  });

  it('строка в теле запроса тоже приводится', () => {
    expect(parse(saleCreate, { record_id: '3', quantity: '2' })).toEqual({
      record_id: 3,
      quantity: 2,
    });
  });
});

describe('Понятные сообщения об ограничениях', () => {
  it('ноль и отрицательные отклоняются с указанием причины', () => {
    expect(messageFor(saleCreate, { record_id: 1, quantity: 0 }, 'quantity')).toBe(
      'Поле «quantity» должно быть больше нуля',
    );
  });

  it('дробное количество отклоняется как нецелое', () => {
    expect(messageFor(saleCreate, { record_id: 1, quantity: 1.5 }, 'quantity')).toBe(
      'Поле «quantity» должно быть целым числом',
    );
  });

  it('пустое название сообщает, что поле не может быть пустым', () => {
    expect(messageFor(genreCreate, { name: '   ' }, 'name')).toBe(
      'Поле «name» не может быть пустым',
    );
  });

  it('пропущенное название сообщает, что поле обязательно', () => {
    expect(messageFor(genreCreate, {}, 'name')).toBe('Поле «name» обязательно');
  });

  it('цена ноль отклоняется', () => {
    const data = { title: 'X', musician_id: 1, genre_id: 1, price: 0 };
    expect(messageFor(recordCreate, data, 'price')).toBe('Поле «price» должно быть больше нуля');
  });
});
