.PHONY: help setup run test quality lint format migrate rollback seed verify up down container-check

help:
	@echo "setup    - установка зависимостей и подготовка .env"
	@echo "run      - локальный запуск приложения"
	@echo "test     - автоматические тесты"
	@echo "quality  - форматирование и статический анализ"
	@echo "migrate  - применение миграций"
	@echo "rollback - откат последней миграции"
	@echo "seed     - тестовые данные"
	@echo "verify   - полный набор локальных проверок (quality + test)"
	@echo "up       - запуск контейнера с БД"
	@echo "down     - остановка контейнера с БД"

setup:
	npm ci || npm install
	@test -f .env || (cp .env.example .env && echo "Создан .env из .env.example - проверьте значения")

run:
	npm start

test:
	npm test

lint:
	npm run lint

format:
	npm run format:check

quality:
	npm run format:check
	npm run lint

migrate:
	npm run migrate

rollback:
	npm run migrate:rollback

seed:
	npm run seed

verify: quality test
	@echo "Все локальные проверки пройдены"

up:
	docker compose up -d

down:
	docker compose down

container-check:
	docker compose ps
