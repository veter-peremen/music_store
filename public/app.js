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

  if (!response.ok) {
    const error = new Error(describeError(data, response.status));
    error.status = response.status;
    throw error;
  }
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
    // 401 посреди работы — сессия закончилась или учётку удалили:
    // возвращаем на экран входа, данные на странице не оставляем.
    if (err.status === 401) {
      showAuthScreen('Сессия завершилась — войдите снова.');
      return null;
    }
    // 403 — роль могли сменить, пока страница была открыта: перечитываем права,
    // чтобы спрятать кнопки, которые уже не работают.
    if (err.status === 403) refreshPermissions();
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

/**
 * Ячейка с кнопками действий. Flex вешается на вложенный блок, а не на саму
 * <td>: ячейка с display:flex перестаёт быть табличной, и её граница и
 * высота расходятся с остальной строкой.
 */
function actionsCell(row) {
  const wrap = document.createElement('div');
  wrap.className = 'actions';
  row.insertCell().append(wrap);
  return wrap;
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

    if (!canWrite()) return;
    const actions = actionsCell(row);
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

    if (!canWrite()) return;
    const actions = actionsCell(row);
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
    if (!canWrite()) return;
    const actions = actionsCell(row);
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

// ---------- вход и регистрация ----------

let currentUser = null;

/** Может ли текущая роль менять данные. Сервер проверяет то же самое сам. */
const canWrite = () =>
  Boolean(currentUser) && (currentUser.role === 'superadmin' || currentUser.role === 'staff');

/** Шапка: кто вошёл и с какой ролью, плюс вкладка пользователей для суперадминистратора. */
function renderAuthState() {
  const whoami = $('#whoami');
  whoami.textContent =
    currentUser.login + ' · ' + (ROLE_TITLES[currentUser.role] || currentUser.role);
  whoami.hidden = false;
  $('#auth-logout').hidden = false;

  const manages = currentUser.role === 'superadmin';
  $('#tab-users').hidden = !manages;
  // Если права потеряны, а вкладка открыта — уводим в каталог,
  // иначе человек останется смотреть на список, который уже не его.
  if (!manages && !$('#view-users').hidden) showView('catalog');
}

/**
 * Прячет всё, что меняет данные, если роли это не положено. Это удобство,
 * а не защита: те же запросы сервер отклонит с 403 сам.
 */
function applyPermissions() {
  const writable = canWrite();
  document.querySelectorAll('[data-write]').forEach((el) => {
    el.hidden = !writable;
  });
  document.body.classList.toggle('read-only', !writable);
}

async function loadMe() {
  try {
    const data = await get('/auth/me');
    currentUser = data.user;
  } catch {
    currentUser = null;
  }
}

async function refreshPermissions() {
  await loadMe();
  if (!currentUser) {
    showAuthScreen('Сессия завершилась — войдите снова.');
    return;
  }
  renderAuthState();
  applyPermissions();
  const current = document.querySelector('.tab[aria-current="true"]');
  run(loaders[current ? current.dataset.view : 'catalog']);
}

/** Убирает со страницы всё, что было загружено под прошлой учётной записью. */
function clearAppData() {
  cache.genres = [];
  cache.musicians = [];
  pendingMove = null;
  if ($('#move-dialog').open) $('#move-dialog').close();

  document.querySelectorAll('#app tbody').forEach((tbody) => {
    tbody.innerHTML = '';
  });
  document.querySelectorAll('#app form').forEach((form) => form.reset());
  fillSelect($('#f-musician'), [], 'все');
  fillSelect($('#f-genre'), [], 'все');
  $('#record-form select[name="musician_id"]').innerHTML = '';
  $('#record-form select[name="genre_id"]').innerHTML = '';
  $('#report-totals').textContent = '';
  $('#whoami').textContent = '';

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.setAttribute('aria-current', String(tab.dataset.view === 'catalog'));
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== 'view-catalog';
  });
}

function showAuthError(message) {
  const node = $('#auth-error');
  node.textContent = message || '';
  node.hidden = !message;
}

/** Экран входа вместо приложения. Данные прошлой сессии со страницы стираются. */
function showAuthScreen(message) {
  currentUser = null;
  clearAppData();
  $('#app').hidden = true;
  $('#auth-screen').hidden = false;
  $('#auth-password').value = '';
  setPasswordVisible(false);
  showAuthError(message || '');
  $('#auth-login').focus();
}

/** Приложение после успешного входа: сначала права, потом данные. */
async function enterApp() {
  $('#auth-screen').hidden = true;
  $('#app').hidden = false;
  showAuthError('');
  renderAuthState();
  applyPermissions();
  checkHealth();
  await run(refreshDictionaries);
  showView('catalog');
}

/** Переключает показ пароля: тип поля, иконка и подпись для читалок. */
function setPasswordVisible(visible, inputSelector = '#auth-password', eyeSelector = '#auth-eye') {
  const input = $(inputSelector);
  const eye = $(eyeSelector);
  input.type = visible ? 'text' : 'password';
  eye.setAttribute('aria-pressed', String(visible));
  eye.setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
  eye.title = visible ? 'Скрыть пароль' : 'Показать пароль';
}

/** Общий путь для входа и регистрации — отличается только адресом. */
async function submitCredentials(path) {
  const form = $('#auth-form');
  if (!form.reportValidity()) return;

  showAuthError('');
  const body = { login: $('#auth-login').value.trim(), password: $('#auth-password').value };

  try {
    const data = await post(path, body);
    currentUser = data.user;
    form.reset();
    setPasswordVisible(false);
    await enterApp();
    toast(
      path.endsWith('register')
        ? 'Учётная запись создана. Права на изменения выдаёт суперадминистратор.'
        : 'Вы вошли как ' + data.user.login,
    );
  } catch (err) {
    showAuthError(err.message);
  }
}

async function logout() {
  try {
    await post('/auth/logout');
  } catch {
    // Даже если сервер не ответил, со страницы уходим: данные показывать нельзя.
  }
  showAuthScreen('Вы вышли из системы.');
}

// ---------- учётные записи ----------

const ROLE_TITLES = {
  superadmin: 'Суперадминистратор',
  staff: 'Сотрудник',
  viewer: 'Наблюдатель',
};

async function loadUsers() {
  const users = await get('/users');
  const tbody = $('#users-table tbody');
  tbody.innerHTML = '';

  users.forEach((user) => {
    const row = tbody.insertRow();
    const isMe = currentUser && user.id === currentUser.id;

    const loginCell = row.insertCell();
    loginCell.append(user.login);
    if (isMe) loginCell.append(badge('это вы'));

    row.insertCell().append(roleSelect(user, isMe));
    cell(row, when(user.created_at));

    const actions = actionsCell(row);
    if (!isMe) actions.append(button('Удалить', () => removeUser(user)));
  });
}

/** Выпадающий список роли. Свою роль менять нельзя — запрет виден сразу. */
function roleSelect(user, isMe) {
  const select = document.createElement('select');
  Object.entries(ROLE_TITLES).forEach(([value, title]) => {
    select.append(new Option(title, value, false, value === user.role));
  });
  select.disabled = isMe;
  select.title = isMe ? 'Свою роль менять нельзя' : 'Сменить роль';
  select.addEventListener('change', async () => {
    const changed = await run(
      () => patch('/users/' + user.id, { role: select.value }),
      'Роль изменена',
    );
    if (!changed) select.value = user.role;
    await run(loadUsers);
  });
  return select;
}

async function removeUser(user) {
  if (!confirm('Удалить учётную запись «' + user.login + '»? Её сессии закроются сразу.')) return;
  await run(() => del('/users/' + user.id), 'Учётная запись удалена');
  await run(loadUsers);
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
  users: loadUsers,
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

  // Операцию запускает клик по кнопке, а не событие close диалога:
  // на close полагаться ненадёжно, а confirmMove сбрасывает pendingMove
  // синхронно, поэтому повторный вызов из close безвреден.
  $('#move-ok').addEventListener('click', () => confirmMove());
  $('#move-dialog').addEventListener('close', (event) => {
    if (event.target.returnValue !== 'ok') pendingMove = null;
  });

  $('#auth-logout').addEventListener('click', logout);
  $('#auth-eye').addEventListener('click', () => {
    setPasswordVisible($('#auth-password').type === 'password');
  });
  $('#auth-register').addEventListener('click', () => submitCredentials('/auth/register'));
  $('#auth-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitCredentials('/auth/login');
  });

  $('#user-eye').addEventListener('click', () => {
    setPasswordVisible($('#user-password').type === 'password', '#user-password', '#user-eye');
  });
  wireForm('#user-form', '/users', 'Учётная запись создана', () => run(loadUsers));

  wireForm('#genre-form', '/genres', 'Жанр создан', refreshDictionaries);
  wireForm('#musician-form', '/musicians', 'Музыкант создан', refreshAll);
  wireForm('#record-form', '/records', 'Пластинка создана', refreshCatalog);

  // Пока не ясно, кто пришёл, не показываем ни приложение, ни форму:
  // иначе на мгновение мелькнёт то, чего видеть нельзя.
  await loadMe();
  if (currentUser) await enterApp();
  else showAuthScreen();
});
