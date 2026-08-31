#!/bin/bash

# Milhas Livre - Optimized Setup Script
# Paraleliza instalação, validação e inicialização

set -e

echo "🚀 Milhas Livre - Optimized Setup"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Check Node version
echo -e "${BLUE}[1/6]${NC} Checking Node version..."
NODE_VERSION=$(node -v)
if [[ "$NODE_VERSION" < "v18" ]]; then
  echo -e "${RED}❌ Node.js 18+ required (you have $NODE_VERSION)${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node $NODE_VERSION${NC}"
echo ""

# 2. Install dependencies (if needed)
echo -e "${BLUE}[2/6]${NC} Installing dependencies..."
if [ ! -d "node_modules" ]; then
  npm install --legacy-peer-deps > /dev/null 2>&1 &
  INSTALL_PID=$!
else
  echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi
echo ""

# 3. Setup environment file
echo -e "${BLUE}[3/6]${NC} Setting up environment..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠️  .env created (UPDATE WITH YOUR CREDENTIALS)${NC}"
  echo ""
  echo -e "${YELLOW}Required environment variables:${NC}"
  grep "^[A-Z_]*=" .env.example | head -10
else
  echo -e "${GREEN}✅ .env already exists${NC}"
fi
echo ""

# 4. Validate environment
echo -e "${BLUE}[4/6]${NC} Validating configuration..."
if grep -q "DATABASE_URL=postgresql://" .env; then
  echo -e "${GREEN}✅ DATABASE_URL configured${NC}"
else
  echo -e "${YELLOW}⚠️  DATABASE_URL not configured in .env${NC}"
  echo "   Set it to: postgresql://user:password@host:5432/milhaslivre"
fi

if grep -q "JWT_SECRET=" .env && [ "$(grep 'JWT_SECRET=' .env | cut -d'=' -f2 | wc -c)" -gt 33 ]; then
  echo -e "${GREEN}✅ JWT_SECRET configured${NC}"
else
  echo -e "${YELLOW}⚠️  JWT_SECRET not set or too short${NC}"
fi
echo ""

# 5. Wait for npm install if started
echo -e "${BLUE}[5/6]${NC} Waiting for dependency installation..."
if [ ! -z "$INSTALL_PID" ]; then
  wait $INSTALL_PID
  echo -e "${GREEN}✅ Dependencies installed${NC}"
fi
echo ""

# 6. Show startup instructions
echo -e "${BLUE}[6/6]${NC} Preparing to start servers..."
echo ""

# Check if this is first run
if [ ! -f "packages/backend/.wrangler" ]; then
  echo -e "${YELLOW}📝 FIRST TIME SETUP - Database migration needed${NC}"
  echo ""
  echo -e "${YELLOW}Before starting, run the database migrations:${NC}"
  echo -e "  ${BLUE}npm run -w backend db:migrate${NC}"
  echo ""
fi

echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "🎯 ${YELLOW}Next steps:${NC}"
echo ""
echo "1. ${BLUE}Configure .env:${NC}"
echo "   DATABASE_URL=postgresql://..."
echo "   REDIS_URL=redis://..."
echo "   JWT_SECRET=<32+ character secret>"
echo ""
echo "2. ${BLUE}Run database migrations:${NC}"
echo "   npm run -w backend db:migrate"
echo ""
echo "3. ${BLUE}Start development servers:${NC}"
echo "   npm run dev"
echo ""
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend:  http://localhost:3000"
echo "📍 Health:   http://localhost:3000/health"
echo ""
echo -e "📖 For more info: ${BLUE}cat README.md${NC}"
echo ""
