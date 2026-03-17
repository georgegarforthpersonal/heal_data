.PHONY: help dev staging prod down logs test typecheck check build migrate migrate-staging migrate-prod shell

# Default environment
ENV ?= dev

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Environments:"
	@echo "  dev              Start development environment (local DB)"
	@echo "  staging          Start staging environment (Neon staging DB)"
	@echo "  prod             Start production environment (Neon prod DB)"
	@echo "  down             Stop all services"
	@echo "  logs             Tail logs from all services"
	@echo ""
	@echo "Development:"
	@echo "  build            Rebuild containers"
	@echo "  shell            Open bash in API container"
	@echo "  shell-staging    Open bash in staging scripts container"
	@echo "  shell-prod       Open bash in prod scripts container"
	@echo ""
	@echo "Database:"
	@echo "  migrate          Run migrations (dev)"
	@echo "  migrate-staging  Run migrations (staging)"
	@echo "  migrate-prod     Run migrations (prod)"
	@echo ""
	@echo "Testing:"
	@echo "  test             Run pytest"
	@echo "  typecheck        Run mypy type checking"
	@echo "  check            Run both typecheck and test"

# =============================================================================
# Environments
# =============================================================================

dev:
	docker compose --profile dev up

staging:
	docker compose --profile staging up

prod:
	docker compose --profile prod up

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose --profile dev build

# =============================================================================
# Development
# =============================================================================

shell:
	docker compose --profile dev run --rm scripts-dev bash

shell-staging:
	docker compose --profile staging run --rm scripts-staging bash

shell-prod:
	docker compose --profile prod run --rm scripts-prod bash

# =============================================================================
# Database Migrations
# =============================================================================

migrate:
	docker compose --profile dev run --rm scripts-dev bash -c "cd /app && PYTHONPATH=/app alembic upgrade head"

migrate-staging:
	docker compose --profile staging run --rm --build scripts-staging bash -c "cd /app && PYTHONPATH=/app alembic upgrade head"

migrate-prod:
	docker compose --profile prod run --rm --build scripts-prod bash -c "cd /app && PYTHONPATH=/app alembic upgrade head"

# =============================================================================
# Testing
# =============================================================================

test:
	docker compose --profile test run --rm test

typecheck:
	@docker run --rm -v "$(PWD)/app/backend:/app" -w /app python:3.11-slim \
		sh -c "pip install -q mypy types-requests && mypy . --config-file mypy.ini"

check: typecheck test
