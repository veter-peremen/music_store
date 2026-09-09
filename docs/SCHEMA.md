# Схема данных

СУБД — PostgreSQL. Схема создаётся версионированными миграциями Knex (`migrations/`).
Применение: `make migrate`, откат последней: `make rollback`.

## Диаграмма связей

```
genres 1 ──< records >── 1 musicians
                │
                ├──< receipts   (поступления, +stock)
                └──< sales      (продажи, -stock, снимок цены)
```

- У пластинки **ровно один** жанр и **ровно один** музыкант (`genre_id`, `musician_id` — NOT NULL).
- «Жанры музыканта» не хранятся: это `DISTINCT` жанров по всем его пластинкам.
- Все внешние ключи — `ON DELETE RESTRICT`: физического удаления музыкантов и пластинок нет (только архивация), поэтому история движений неуничтожима.

## genres — жанры

| Поле                        | Тип          | Ограничения               |
| --------------------------- | ------------ | ------------------------- |
| `id`                        | serial       | PK                        |
| `name`                      | varchar(120) | NOT NULL, **UNIQUE**      |
| `created_at` / `updated_at` | timestamptz  | NOT NULL, default `now()` |

## musicians — музыканты

| Поле                        | Тип          | Ограничения                             |
| --------------------------- | ------------ | --------------------------------------- |
| `id`                        | serial       | PK                                      |
| `name`                      | varchar(200) | NOT NULL                                |
| `country`                   | varchar(100) | NULL                                    |
| `notes`                     | text         | NULL                                    |
| `archived_at`               | timestamptz  | NULL = активен; иначе в архиве (индекс) |
| `created_at` / `updated_at` | timestamptz  | NOT NULL, default `now()`               |

## records — пластинки

| Поле                        | Тип           | Ограничения                                      |
| --------------------------- | ------------- | ------------------------------------------------ |
| `id`                        | serial        | PK                                               |
| `title`                     | varchar(200)  | NOT NULL                                         |
| `musician_id`               | integer       | NOT NULL, FK → `musicians.id`, RESTRICT (индекс) |
| `genre_id`                  | integer       | NOT NULL, FK → `genres.id`, RESTRICT (индекс)    |
| `price`                     | numeric(12,2) | NOT NULL, CHECK `price > 0`                      |
| `stock`                     | integer       | NOT NULL, default 0, CHECK `stock >= 0`          |
| `year`                      | integer       | NULL                                             |
| `archived_at`               | timestamptz   | NULL = в каталоге; иначе в архиве (индекс)       |
| `created_at` / `updated_at` | timestamptz   | NOT NULL, default `now()`                        |

`stock` — денормализованный текущий остаток. Он меняется только внутри транзакции движения, что позволяет проверять правило «нельзя продать больше остатка» с блокировкой строки (`SELECT ... FOR UPDATE`).

## receipts — поступления

| Поле         | Тип         | Ограничения                                    |
| ------------ | ----------- | ---------------------------------------------- |
| `id`         | serial      | PK                                             |
| `record_id`  | integer     | NOT NULL, FK → `records.id`, RESTRICT (индекс) |
| `quantity`   | integer     | NOT NULL, CHECK `quantity > 0`                 |
| `created_at` | timestamptz | NOT NULL, default `now()`                      |

## sales — продажи

| Поле         | Тип           | Ограничения                                                          |
| ------------ | ------------- | -------------------------------------------------------------------- |
| `id`         | serial        | PK                                                                   |
| `record_id`  | integer       | NOT NULL, FK → `records.id`, RESTRICT (индекс)                       |
| `quantity`   | integer       | NOT NULL, CHECK `quantity > 0`                                       |
| `unit_price` | numeric(12,2) | NOT NULL, CHECK `unit_price > 0` — **снимок** цены на момент продажи |
| `total`      | numeric(12,2) | NOT NULL, = `quantity * unit_price`                                  |
| `created_at` | timestamptz   | NOT NULL, default `now()`                                            |

Снимок цены нужен, чтобы последующее изменение `records.price` не искажало уже проведённые продажи.

## Инварианты, обеспечиваемые приложением

Часть правил невыразима ограничениями таблиц и проверяется в коде (`src/domain/`), в транзакции:

1. `sales.quantity <= records.stock` на момент продажи (иначе 409 `INSUFFICIENT_STOCK`).
2. Движения запрещены по архивной пластинке (409 `RECORD_ARCHIVED`).
3. Архивация музыканта каскадно архивирует все его активные пластинки.
4. Пластинка не может быть активна при архивном музыканте (409 `MUSICIAN_ARCHIVED`).
5. Жанр удаляется, только если на него не ссылается ни одна пластинка (409 `GENRE_IN_USE`).

## Денежные значения

Хранятся как `numeric(12,2)` и возвращаются драйвером `pg` строками (`"3900.00"`), чтобы исключить потери точности. Расчёт суммы ведётся в копейках (`src/domain/sales.js`, функция `computeTotal`).
