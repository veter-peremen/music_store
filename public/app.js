'use strict';

/**
 * Интерфейс складского учёта. Своего состояния почти не держит:
 * после каждой операции перечитывает данные с сервера, потому что
 * остаток и архивность меняются транзакциями на стороне API.
 */

/** Справочники держим в памяти — они нужны для подписей и выпадающих списков. */
const cache = { genres: [], musicians: [] };

async function request(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) throw new Error(describeError(data, response.status));
  return data;
}

/** Разворачивает ответ об ошибке в одну человеческую строку. */
function describeError(data, status) {
  const error = data && data.error;
  if (!error) return 'Ошибка ' + status;
  if (Array.isArray(error.details) && error.details.length > 0) {
    return error.details.map((d) => d.message).join('; ');
  }
  return error.message || 'Ошибка ' + status;
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const patch = (path, body) => request('PATCH', path, body);
const del = (path) => request('DELETE', path);

const $ = (selector) => document.querySelector(selector);
const money = (value) => Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2 });
const when = (iso) => new Date(iso).toLocaleString('ru-RU');

let toastTimer;
function toast(message, isError) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', Boolean(isError));
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 4000);
}

/** Выполняет действие и показывает результат — успех или причину отказа. */
async function run(action, successMessage) {
  try {
    const result = await action();
    if (successMessage) toast(successMessage);
    return result === undefined ? true : result;
  } catch (err) {
    toast(err.message, true);
    return null;
  }
}

function fillSelect(select, items, placeholder) {
  const previous = select.value;
  select.innerHTML = '';
  if (placeholder !== undefined) select.append(new Option(placeholder, ''));
  items.forEach((item) => select.append(new Option(item.name, item.id)));
  if (previous) select.value = previous;
}

const nameById = (list, id) => {
  const found = list.find((item) => item.id === id);
  return found ? found.name : '—';
};

function cell(row, text, className) {
  const td = row.insertCell();
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function button(label, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function badge(text) {
  const el = document.createElement('span');
  el.className = 'badge';
  el.textContent = text;
  return el;
}

// ---------- каталог ----------

async function loadRecords() {
  const params = new URLSearchParams();
  const musician = $('#f-musician').value;
  const genre = $('#f-genre').value;
  if (musician) params.set('musician_id', musician);
  if (genre) params.set('genre_id', genre);
  params.set('archived', $('#f-archived').value);

  const records = await get('/records?' + params);
  const tbody = $('#records-table tbody');
  tbody.innerHTML = '';
  $('#records-empty').hidden = records.length > 0;

  records.forEach((record) => {
    const row = tbody.insertRow();
    if (record.archived_at) row.className = 'archived';

    const titleCell = row.insertCell();
    titleCell.append(record.title);
    if (record.archived_at) titleCell.append(badge('в архиве'));

    cell(row, nameById(cache.musicians, record.musician_id));
    cell(row, nameById(cache.genres, record.genre_id));
    cell(row, money(record.price), 'num');
    cell(row, record.stock, 'num');

    const actions = row.insertCell();
    actions.className = 'actions';
    if (record.archived_at) {
      actions.append(button('Вернуть', () => restoreRecord(record)));
    } else {
      actions.append(
        button('Продажа', () => openMove('sale', record)),
        button('Поступление', () => openMove('receipt', record)),
        button('Цена', () => editPrice(record)),
        button('В архив', () => archiveRecord(record)),
      );
    }
  });
}

async function restoreRecord(record) {
  await run(() => post('/records/' + record.id + '/restore'), 'Пластинка вернулась в каталог');
  await refreshCatalog();
}

async function archiveRecord(record) {
  await run(() => del('/records/' + record.id), 'Пластинка убрана в архив');
  await refreshCatalog();
}

async function editPrice(record) {
  const entered = prompt('Новая цена для «' + record.title + '»', record.price);
  if (entered === null) return;
  await run(() => patch('/records/' + record.id, { price: entered }), 'Цена изменена');
  await refreshCatalog();
}

// ---------- складские операции ----------

let pendingMove = null;

function openMove(kind, record) {
  pendingMove = { kind: kind, record: record };
  $('#move-title').textContent = kind === 'sale' ? 'Оформить продажу' : 'Оприходовать партию';
  $('#move-subtitle').textContent = '«' + record.title + '», на складе ' + record.stock + ' шт.';
  $('#move-qty').value = 1;
  // max намеренно не ставим: правило «не продать больше остатка» живёт в
  // домене на сервере. Пусть отказ приходит оттуда — с настоящей причиной.
  $('#move-dialog').showModal();
}

async function confirmMove() {
  if (!pendingMove) return;
  const kind = pendingMove.kind;
  const record = pendingMove.record;
  const quantity = Number($('#move-qty').value);
  pendingMove = null;

  const result =
    kind === 'sale'
      ? await run(() => post('/sales', { record_id: record.id, quantity: quantity }))
      : await run(() => post('/records/' + record.id + '/receipts', { quantity: quantity }));

  if (result && result.record) {
    toast(
      (kind === 'sale' ? 'Продано ' : 'Принято ') +
        quantity +
        ' шт., остаток ' +
        result.record.stock,
    );
  }
  await refreshCatalog();
}

// ---------- музыканты ----------

async function loadMusicians() {
  const musicians = await get('/musicians?archived=' + $('#m-archived').value);
  const tbody = $('#musicians-table tbody');
  tbody.innerHTML = '';

  musicians.forEach((musician) => {
    const row = tbody.insertRow();
    if (musician.archived_at) row.className = 'archived';

    const nameCell = row.insertCell();
    nameCell.append(musician.name);
    if (musician.archived_at) nameCell.append(badge('в архиве'));

    cell(row, musician.country || '—');

    // Жанры вычисляются сервером из пластинок — запрашиваем отдельно,
    // не блокируя отрисовку остальной таблицы.
    const genresCell = cell(row, '…');
    get('/musicians/' + musician.id + '/genres')
      .then((genres) => {
        genresCell.textContent = genres.length ? genres.map((g) => g.name).join(', ') : '—';
      })
      .catch(() => {
        genresCell.textContent = '—';
      });

    const actions = row.insertCell();
    actions.className = 'actions';
    if (musician.archived_at) {
      actions.append(button('Вернуть', () => restoreMusician(musician)));
    } else {
      actions.append(button('В архив', () => archiveMusician(musician)));
    }
  });
}

async function restoreMusician(musician) {
  await run(() => post('/musicians/' + musician.id + '/restore'), 'Музыкант возвращён');
  await refreshAll();
}

async function archiveMusician(musician) {
  const result = await run(() => del('/musicians/' + musician.id));
  if (result && result.archived_records) {
    const count = result.archived_records.length;
    toast(count ? 'В архив ушли ' + count + ' пластинок музыканта' : 'Музыкант в архиве');
  }
  await refreshAll();
}

// ---------- жанры ----------

function loadGenres() {
  const tbody = $('#genres-table tbody');
  tbody.innerHTML = '';

  cache.genres.forEach((genre) => {
    const row = tbody.insertRow();
    cell(row, genre.name);
    const actions = row.insertCell();
    actions.className = 'actions';
    actions.append(
      button('Переименовать', () => renameGenre(genre)),
      button('Удалить', () => removeGenre(genre)),
    );
  });
}

async function renameGenre(genre) {
  const entered = prompt('Новое название жанра', genre.name);
  if (entered === null) return;
  await run(() => patch('/genres/' + genre.id, { name: entered }), 'Жанр переименован');
  await refreshDictionaries();
}

async function removeGenre(genre) {
  await run(() => del('/genres/' + genre.id), 'Жанр удалён');
  await refreshDictionaries();
}

// ---------- продажи и отчёт ----------

async function loadSales() {
  const [sales, records] = await Promise.all([get('/sales'), get('/records?archived=all')]);
  const titleById = new Map(records.map((r) => [r.id, r.title]));

  const tbody = $('#sales-table tbody');
  tbody.innerHTML = '';
  $('#sales-empty').hidden = sales.length > 0;

  sales.forEach((sale) => {
    const row = tbody.insertRow();
    cell(row, sale.id);
    cell(row, titleById.get(sale.record_id) || '#' + sale.record_id);
    cell(row, sale.quantity, 'num');
    cell(row, money(sale.unit_price), 'num');
    cell(row, money(sale.total), 'num');
    cell(row, when(sale.created_at));
  });
}

async function loadReport() {
  const report = await get('/reports/top-sellers?limit=' + ($('#r-limit').value || 10));
  const tbody = $('#report-table tbody');
  tbody.innerHTML = '';
  $('#report-empty').hidden = report.items.length > 0;

  report.items.forEach((item) => {
    const row = tbody.insertRow();
    if (item.archived) row.className = 'archived';
    const titleCell = row.insertCell();
    titleCell.append(item.title);
    if (item.archived) titleCell.append(badge('в архиве'));
    cell(row, item.musician);
    cell(row, item.total_quantity, 'num');
    cell(row, money(item.revenue), 'num');
    cell(row, item.revenue_share + '%', 'num');
  });

  // Формулировка без склоняемого существительного после числа:
  // «по 1 позициям» резало бы глаз, а склонять ради одной строки незачем.
  $('#report-totals').textContent = report.items.length
    ? 'Итого: ' +
      report.total_quantity +
      ' шт. на ' +
      money(report.total_revenue) +
      ' — позиций в отчёте: ' +
      report.positions
    : '';
}

// ---------- обновление и навигация ----------

async function refreshDictionaries() {
  const results = await Promise.all([get('/genres'), get('/musicians?archived=all')]);
  cache.genres = results[0];
  cache.musicians = results[1];

  fillSelect($('#f-musician'), cache.musicians, 'все');
  fillSelect($('#f-genre'), cache.genres, 'все');
  fillSelect(
    $('#record-form select[name="musician_id"]'),
    cache.musicians.filter((m) => !m.archived_at),
  );
  fillSelect($('#record-form select[name="genre_id"]'), cache.genres);

  loadGenres();
}

const refreshCatalog = () => run(loadRecords);
const refreshMusicians = () => run(loadMusicians);

async function refreshAll() {
  await run(refreshDictionaries);
  await refreshMusicians();
}

const loaders = {
  catalog: loadRecords,
  musicians: loadMusicians,
  genres: async () => loadGenres(),
  sales: loadSales,
  report: loadReport,
};

function showView(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.setAttribute('aria-current', String(tab.dataset.view === name));
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== 'view-' + name;
  });
  run(loaders[name]);
}

/** Собирает тело запроса из формы, выбрасывая пустые необязательные поля. */
function formBody(form) {
  const body = {};
  new FormData(form).forEach((value, key) => {
    const trimmed = String(value).trim();
    if (trimmed !== '') body[key] = trimmed;
  });
  return body;
}

function wireForm(selector, path, successMessage, after) {
  $(selector).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const created = await run(() => post(path, formBody(form)), successMessage);
    if (created) {
      form.reset();
      await after();
    }
  });
}

async function checkHealth() {
  const node = $('#health');
  try {
    const status = await get('/health/ready');
    const up = status.db === 'up';
    node.textContent = up ? 'сервер и база на связи' : 'база недоступна';
    node.className = 'health ' + (up ? 'up' : 'down');
  } catch {
    node.textContent = 'сервер недоступен';
    node.className = 'health down';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#tabs').addEventListener('click', (event) => {
    if (event.target.matches('.tab')) showView(event.target.dataset.view);
  });

  ['#f-musician', '#f-genre', '#f-archived'].forEach((id) =>
    $(id).addEventListener('change', refreshCatalog),
  );
  $('#m-archived').addEventListener('change', refreshMusicians);
  $('#r-limit').addEventListener('change', () => run(loadReport));

  $('#move-dialog').addEventListener('close', (event) => {
    if (event.target.returnValue === 'ok') confirmMove();
    else pendingMove = null;
  });

  wireForm('#genre-form', '/genres', 'Жанр создан', refreshDictionaries);
  wireForm('#musician-form', '/musicians', 'Музыкант создан', refreshAll);
  wireForm('#record-form', '/records', 'Пластинка создана', refreshCatalog);

  await checkHealth();
  await run(refreshDictionaries);
  await refreshCatalog();
});
