# DecentralHub — быстрые команды
# Алиасы к pnpm-скриптам; можно использовать make или pnpm напрямую.

.PHONY: setup setup-fast dev db-up db-up-all db-down smoke typecheck help

help:
	@echo "DecentralHub — команды для локальной разработки"
	@echo ""
	@echo "  make db-up      — PostgreSQL через Docker"
	@echo "  make setup      — первичная настройка (.env, install, db push)"
	@echo "  make setup-fast — setup без typecheck"
	@echo "  make dev        — API (:8080) + Web (:5000)"
	@echo "  make smoke      — smoke-тест API"
	@echo ""
	@echo "Или: pnpm db:up && pnpm setup && pnpm dev"

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

typecheck:
	pnpm typecheck
