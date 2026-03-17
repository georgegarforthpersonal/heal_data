.PHONY: help test typecheck lint check dev up down logs

help:
	@echo "Available commands:"
	@echo "  make test       - Run pytest in Docker"
	@echo "  make typecheck  - Run mypy type checking"
	@echo "  make check      - Run both tests and typecheck"
	@echo "  make dev        - Start development environment"
	@echo "  make up         - Start all services"
	@echo "  make down       - Stop all services"
	@echo "  make logs       - Tail logs from all services"

test:
	docker compose --profile test run --rm test

typecheck:
	@docker run --rm -v "$(PWD)/app/backend:/app" -w /app python:3.11-slim \
		sh -c "pip install -q mypy types-requests && mypy . --config-file mypy.ini"

check: typecheck test

dev:
	docker compose up

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f
