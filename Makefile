.PHONY: help setup deploy start stop restart status


help:
	@echo "setup    - первоначальная настройка проекта"
	@echo "deploy      - деплой последней версии проекта"
	@echo "start      - запуск"
	@echo "stop      - остановка"
	@echo "restart      - перезапуск"
	@echo "status      - просмотр статуса"


setup:
	@echo "первичная настройка начата"
	git clone https://github.com/veter-peremen/music_store/
	npm install
	cp .env.example .env
	@echo "конфиг создан!"

deploy:
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
