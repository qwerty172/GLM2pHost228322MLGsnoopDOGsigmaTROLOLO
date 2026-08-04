.PHONY: help db-up db-up-all db-down setup setup-fast dev smoke typecheck build

help: ## Показать команды
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

db-up: ## PostgreSQL в Docker (порт 5432)
	pnpm db:up

db-up-all: ## PostgreSQL + Redis + coturn
	pnpm db:up:all

db-down: ## Остановить docker-сервисы
	pnpm db:down

setup: ## .env + секреты + install + db push + typecheck
	pnpm setup

setup-fast: ## setup без typecheck
	pnpm setup:fast

dev: ## API :8080 + Web :5000
	pnpm dev

smoke: ## Smoke-тест API (нужен запущенный dev)
	pnpm smoke

typecheck: ## Проверка типов
	pnpm run typecheck

build: ## Production-сборка
	pnpm run build
