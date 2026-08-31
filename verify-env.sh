#!/bin/bash

# Environment Verification Script
# Checks all prerequisites for running Milhas Livre

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅${NC} $2"
    ((PASS++))
  else
    echo -e "${RED}❌${NC} $2"
    ((FAIL++))
  fi
}

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Milhas Livre - Environment Verification   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Node.js
echo -e "${YELLOW}System Requirements:${NC}"
node --version > /dev/null 2>&1
check $? "Node.js installed (v$(node -v))"

npm --version > /dev/null 2>&1
check $? "npm installed (v$(npm -v))"

# Git
git --version > /dev/null 2>&1
check $? "Git installed"

# Dependencies
echo ""
echo -e "${YELLOW}Dependencies:${NC}"
[ -d "node_modules" ]
check $? "Dependencies installed"

[ -f "package.json" ]
check $? "package.json exists"

# Configuration
echo ""
echo -e "${YELLOW}Configuration:${NC}"
[ -f ".env" ]
check $? ".env file exists"

# Optional: Check database connection
echo ""
echo -e "${YELLOW}Database (Optional):${NC}"
if [ -f ".env" ]; then
  DB_URL=$(grep "DATABASE_URL" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ')
  if [ ! -z "$DB_URL" ] && [ "$DB_URL" != "postgresql://localhost/milhaslivre" ]; then
    echo -e "${GREEN}✅${NC} DATABASE_URL configured"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠️ ${NC} DATABASE_URL not configured (required for migrations)"
    ((FAIL++))
  fi
fi

# Optional: Check Redis
echo ""
echo -e "${YELLOW}Cache (Optional):${NC}"
if [ -f ".env" ]; then
  REDIS_URL=$(grep "REDIS_URL" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ')
  if [ ! -z "$REDIS_URL" ] && [ "$REDIS_URL" != "redis://localhost:6379" ]; then
    echo -e "${GREEN}✅${NC} REDIS_URL configured"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠️ ${NC} REDIS_URL not configured (optional, for caching)"
  fi
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo -e "Ready to start development:"
  echo -e "  ${BLUE}make dev${NC}              # Start both servers"
  echo -e "  ${BLUE}make db-migrate${NC}      # Run database migrations"
  exit 0
else
  echo -e "${RED}❌ $FAIL check(s) failed${NC}"
  echo ""
  echo -e "Please fix the issues above and try again."
  exit 1
fi
