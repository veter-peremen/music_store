.PHONY: help setup deploy start stop restart status migrate rollback verify test test:coverage test:db:setup test:db:clean test:db:migrate test:db:rollback lint lint:fix


TEST_DB_NAME ?= music_store_test
DB_USER ?= ozzy
NODE_ENV_TEST = test

help:
	@echo "setup    - первоначальная настройка проекта"
	@echo "deploy      - деплой последней версии проекта"
	@echo "start      - запуск"
	@echo "stop      - остановка"
	@echo "restart      - перезапуск"
	@echo "status      - просмотр статуса"
	@echo "migrate		- провести миграцию"
	@echo "rollback 	- откат миграции"
	@echo "test 	- запуск теста"
	@echo "test:coverage 	- анализ покрытия тестирования"
	@echo "test:db:setup 	- создание тестовой базы"
	@echo "test:db:clean 	- очистка тестовой базы"
	@echo "test:db:migrate 	- провести миграцию на тестовую базу"
	@echo "test:db:rollback 	- откат миграции на тестовой базе"
	@echo "lint 	- линт-тест кода"
	@echo "lint:fix 	- линт-тест с исправлениями"
	@echo "verify		- полная проверка"

setup:
	@echo "первичная настройка начата"
	git clone https://github.com/veter-peremen/music_store/ .
	npm install
	@test -f .env || (cp .env.example .env && echo "конфиг создан!")

deploy:
	@test -f ./deploy.sh || (echo "скрипт deploy.sh не найден!" && exit 1)
	@echo "деплой запущен"
	./deploy.sh

start:
	sudo systemctl start music-store
	@echo "сервер запущен"

stop:
	sudo systemctl stop music-store
	@echo "сервер остановлен"

restart:
	sudo systemctl restart music-store
	@echo "сервер перезагружен"

status:
	sudo systemctl status music-store

migrate:
	npx knex migrate:latest

rollback:
	npx knex migrate:rollback

test: 
	@echo "запускаем тесты"
	NODE_ENV=$(NODE_ENV_TEST) DB_NAME=$(TEST_DB_NAME) npm test

test:coverage: 
	@echo "тесты coverage запущены, отчет составляется"
	NODE_ENV=$(NODE_ENV_TEST) DB_NAME=$(TEST_DB_NAME) npm run test:coverage
	@echo "отчет доступен в папке coverage/lcov-report/index.html"

test:db:setup:
	@echo "🛠️  Проверяем и создаем тестовую базу данных '$(TEST_DB_NAME)'..."
	@sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$(TEST_DB_NAME)'" | grep -q 1 || \
		(sudo -u postgres psql -c "CREATE DATABASE $(TEST_DB_NAME) OWNER $(DB_USER);" && \
		sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $(TEST_DB_NAME) TO $(DB_USER);")
	@echo "миграции на тестовой базе проведены"
	NODE_ENV=$(NODE_ENV_TEST) DB_NAME=$(TEST_DB_NAME) npx knex migrate:latest
	@echo "тестовая база готова"

test:db:clean:
	npm run db:test:clean

test:db:migrate:
	npm run db:test:migrate

test:db:rollback:
	npm run db:test:migrate:rollback

lint:
	eslint .

lint:fix:
	eslint . -- fix




#.PHONY: help setup run test quality lint format migrate rollback seed verify up down container-check

#help:
#	@echo "setup    - установка зависимостей и подготовка .env"
#	@echo "run      - локальный запуск приложения"
#	@echo "test     - автоматические тесты"
#	@echo "quality  - форматирование и статический анализ"
#	@echo "migrate  - применение миграций"
#	@echo "rollback - откат последней миграции"
#	@echo "seed     - тестовые данные"
#	@echo "verify   - полный набор локальных проверок (quality + test)"
#	@echo "up       - запуск контейнера с БД"
#	@echo "down     - остановка контейнера с БД"

#setup:
#	npm ci || npm install
#	@test -f .env || (cp .env.example .env && echo "Создан .env из .env.example - проверьте значения")

#run:
#	npm start

#test:
#	npm test

#lint:
#	npm run lint

#format:
#	npm run format:check

#quality:
#	npm run format:check
#	npm run lint

#migrate:
#	npm run migrate

#rollback:
#	npm run migrate:rollback

#seed:
#	npm run seed

#verify: quality test
#	@echo "Все локальные проверки пройдены"

#up:
#	docker compose up -d

#down:
#	docker compose down

#container-check:
#	docker compose ps
