# Описание API

Базовый адрес: `http://localhost:3000` (порт задаётся `PORT`).
Формат обмена — JSON. Все изменяющие запросы принимают `Content-Type: application/json`.

## Формат ошибок

Любая ошибка возвращается в едином виде:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Недостаточно остатка: доступно 5, запрошено 999"
  }
}
```

Для ошибок валидации добавляется массив `details`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса",
    "details": [{ "field": "quantity", "message": "Number must be greater than 0" }]
  }
}
```

| HTTP | Коды                                | Когда                                                                     |
| ---- | ----------------------------------- | ------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                  | тело или параметры не прошли проверку схемой                              |
| 404  | `NOT_FOUND`                         | сущность или маршрут не найдены                                           |
| 409  | `INSUFFICIENT_STOCK`                | продажа превышает остаток                                                 |
| 409  | `RECORD_ARCHIVED`                   | движение по архивной пластинке                                            |
| 409  | `MUSICIAN_ARCHIVED`                 | возврат пластинки при архивном музыканте / привязка к архивному музыканту |
| 409  | `GENRE_IN_USE`                      | удаление жанра, на который ссылаются пластинки                            |
| 409  | `ALREADY_ARCHIVED` / `NOT_ARCHIVED` | повторная архивация или возврат неархивной записи                         |
| 409  | `DUPLICATE`                         | нарушение уникальности (например, имя жанра)                              |
| 500  | `INTERNAL_ERROR`                    | непредвиденная ошибка                                                     |

## Служебные

| Метод | Путь            | Описание                                                        |
| ----- | --------------- | --------------------------------------------------------------- |
| GET   | `/health`       | живость процесса, без обращения к БД                            |
| GET   | `/health/ready` | готовность: проверяет соединение с БД (503, если БД недоступна) |

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":38}

curl http://localhost:3000/health/ready
# {"status":"ready","db":"up"}
```

## Жанры

| Метод  | Путь          | Описание                                             |
| ------ | ------------- | ---------------------------------------------------- |
| GET    | `/genres`     | список жанров                                        |
| GET    | `/genres/:id` | один жанр                                            |
| POST   | `/genres`     | создать: `{ "name": "Rock" }`                        |
| PATCH  | `/genres/:id` | переименовать                                        |
| DELETE | `/genres/:id` | удалить (только если на жанр не ссылаются пластинки) |

```bash
curl -X DELETE http://localhost:3000/genres/1
# 409 {"error":{"code":"GENRE_IN_USE","message":"Нельзя удалить жанр: на него ссылаются пластинки (2 шт.)"}}
```

## Музыканты

| Метод  | Путь                                   | Описание                                                         |
| ------ | -------------------------------------- | ---------------------------------------------------------------- |
| GET    | `/musicians?archived=false\|true\|all` | список; по умолчанию только активные                             |
| GET    | `/musicians/:id`                       | один музыкант                                                    |
| GET    | `/musicians/:id/genres`                | **вычисляемые** жанры музыканта (из его пластинок)               |
| POST   | `/musicians`                           | создать: `{ "name": "Pink Floyd", "country": "Великобритания" }` |
| PATCH  | `/musicians/:id`                       | изменить                                                         |
| DELETE | `/musicians/:id`                       | **архивация**: каскадом архивирует его пластинки                 |
| POST   | `/musicians/:id/restore`               | вернуть из архива (только самого музыканта)                      |

```bash
curl -X DELETE http://localhost:3000/musicians/1
# 200 {"musician":{...,"archived_at":"2026-09-09T18:02:05.266Z"},"archived_records":[1,2]}
```

## Пластинки

| Метод  | Путь                                                        | Описание                                         |
| ------ | ----------------------------------------------------------- | ------------------------------------------------ |
| GET    | `/records?musician_id=&genre_id=&archived=false\|true\|all` | каталог с фильтрами                              |
| GET    | `/records/:id`                                              | одна пластинка                                   |
| POST   | `/records`                                                  | создать                                          |
| PATCH  | `/records/:id`                                              | изменить (в т.ч. цену)                           |
| DELETE | `/records/:id`                                              | **архивация**                                    |
| POST   | `/records/:id/restore`                                      | вернуть из архива (музыкант должен быть активен) |

Тело для создания:

```json
{
  "title": "Kind of Blue",
  "musician_id": 2,
  "genre_id": 2,
  "price": 3900.0,
  "year": 1959,
  "stock": 0
}
```

## Поступления

| Метод | Путь                    | Описание                                 |
| ----- | ----------------------- | ---------------------------------------- |
| POST  | `/records/:id/receipts` | оприходовать партию: `{ "quantity": 5 }` |
| GET   | `/records/:id/receipts` | история поступлений по пластинке         |

Поступление атомарно увеличивает `records.stock`:

```bash
curl -X POST http://localhost:3000/records/3/receipts \
  -H 'Content-Type: application/json' -d '{"quantity":5}'
# 201 {"receipt":{"id":1,"record_id":3,"quantity":5,...},"record":{...,"stock":10}}
```

## Продажи

| Метод | Путь     | Описание                                              |
| ----- | -------- | ----------------------------------------------------- |
| GET   | `/sales` | история продаж                                        |
| POST  | `/sales` | оформить продажу: `{ "record_id": 3, "quantity": 2 }` |

Продажа в одной транзакции проверяет остаток, фиксирует снимок цены и уменьшает `stock`:

```bash
curl -X POST http://localhost:3000/sales \
  -H 'Content-Type: application/json' -d '{"record_id":3,"quantity":2}'
# 201 {"sale":{"id":1,"quantity":2,"unit_price":"3900.00","total":"7800.00"},"record":{...,"stock":5}}
```

Ключевое правило предметной области — нельзя продать больше остатка:

```bash
curl -X POST http://localhost:3000/sales \
  -H 'Content-Type: application/json' -d '{"record_id":3,"quantity":999}'
# 409 {"error":{"code":"INSUFFICIENT_STOCK","message":"Недостаточно остатка: доступно 5, запрошено 999"}}
```

Движение по архивной пластинке запрещено:

```bash
curl -X POST http://localhost:3000/sales \
  -H 'Content-Type: application/json' -d '{"record_id":1,"quantity":1}'
# 409 {"error":{"code":"RECORD_ARCHIVED","message":"Пластинка находится в архиве: движения по ней запрещены"}}
```
