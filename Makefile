.PHONY: help db-up db-up-all db-down setup setup-fast dev smoke bootstrap

help:
	@echo "DecentralHub — быстрые команды"
	@echo ""
	@echo "  make bootstrap   — db:up + setup (первый запуск)"
	@echo "  make db-up       — PostgreSQL в Docker"
	@echo "  make setup       — .env, секреты, install, db push"
	@echo "  make setup-fast  — setup без typecheck"
	@echo "  make dev         — API :8080 + Web :5000"
	@echo "  make smoke       — smoke-тест API"
	@echo ""
	@echo "На потом:"
	@echo "  make db-up-all   — postgres + redis + coturn"
	@echo "  make db-down     — остановить docker-compose"
	@echo "  pnpm typecheck   — проверка типов"

bootstrap: db-up setup

db-up:
	pnpm db:up

db-up-all:
	pnpm db:up:all

db-down:
	pnpm db:down

setup:
	pnpm setup

setup-fast:
	pnpm setup:fast

dev:
	pnpm dev

smoke:
	pnpm smoke
