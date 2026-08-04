# DecentralHub — короткие алиасы (см. README «Быстрый старт»)
.PHONY: help db-up db-down setup setup-fast dev smoke typecheck

help:
	@echo "DecentralHub — быстрые команды"
	@echo ""
	@echo "  make db-up      — PostgreSQL в Docker (infra/docker-compose.dev.yml)"
	@echo "  make setup      — .env, секреты, pnpm install, db push, typecheck"
	@echo "  make setup-fast — setup без typecheck"
	@echo "  make dev        — API :8080 + Web :5000"
	@echo "  make smoke      — smoke-тест API"
	@echo "  make typecheck  — проверка типов"
	@echo ""
	@echo "Типичный первый запуск: make db-up && make setup && make dev"

db-up:
	pnpm db:up

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
	pnpm run typecheck
