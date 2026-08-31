.PHONY: help setup install dev dev-backend dev-frontend db-migrate db-reset test lint build clean audit

# Colors
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

help:
	@echo "$(BLUE)╔════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║  Milhas Livre - Development Commands       ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Setup & Installation:$(NC)"
	@echo "  make setup              $(YELLOW)# Complete first-time setup$(NC)"
	@echo "  make install            $(YELLOW)# Install dependencies$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev                $(YELLOW)# Start both servers (optimized parallel)$(NC)"
	@echo "  make dev-backend        $(YELLOW)# Start backend only (port 3000)$(NC)"
	@echo "  make dev-frontend       $(YELLOW)# Start frontend only (port 5173)$(NC)"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  make db-migrate         $(YELLOW)# Run database migrations$(NC)"
	@echo "  make db-reset           $(YELLOW)# Reset database (recreate schema)$(NC)"
	@echo ""
	@echo "$(GREEN)Code Quality:$(NC)"
	@echo "  make test               $(YELLOW)# Run test suite$(NC)"
	@echo "  make lint               $(YELLOW)# Run linter$(NC)"
	@echo "  make audit              $(YELLOW)# Security audit$(NC)"
	@echo ""
	@echo "$(GREEN)Build & Deployment:$(NC)"
	@echo "  make build              $(YELLOW)# Build for production$(NC)"
	@echo "  make clean              $(YELLOW)# Clean build artifacts$(NC)"
	@echo ""

setup:
	@echo "$(BLUE)Running setup...$(NC)"
	@chmod +x setup.sh dev.sh
	@./setup.sh

install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install --legacy-peer-deps

dev:
	@echo "$(BLUE)Starting development servers...$(NC)"
	@chmod +x dev.sh
	@./dev.sh

dev-backend:
	@echo "$(BLUE)Starting backend server (port 3000)...$(NC)"
	@npm run dev -w backend

dev-frontend:
	@echo "$(BLUE)Starting frontend server (port 5173)...$(NC)"
	@npm run dev -w frontend

db-migrate:
	@echo "$(BLUE)Running database migrations...$(NC)"
	@npm run -w backend db:migrate
	@echo "$(GREEN)✅ Migrations complete$(NC)"

db-reset:
	@echo "$(RED)⚠️  This will recreate your database schema$(NC)"
	@read -p "Continue? (y/N): " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "$(BLUE)Resetting database...$(NC)"; \
		npm run -w backend db:migrate; \
		echo "$(GREEN)✅ Database reset$(NC)"; \
	fi

test:
	@echo "$(BLUE)Running tests...$(NC)"
	npm test

lint:
	@echo "$(BLUE)Linting code...$(NC)"
	npm run lint

audit:
	@echo "$(BLUE)Security audit...$(NC)"
	npm audit --production

build:
	@echo "$(BLUE)Building for production...$(NC)"
	npm run build

clean:
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf dist build .next
	@rm -rf packages/*/dist
	@rm -rf packages/*/.wrangler
	@echo "$(GREEN)✅ Clean complete$(NC)"

.DEFAULT_GOAL := help
