#!/bin/bash

# Milhas Livre - Optimized Development Server
# Starts frontend + backend in parallel with proper error handling

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════╗"
echo "║   Milhas Livre - Development Server        ║"
echo "║   Optimized Parallel Execution             ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
echo -e "${BLUE}[Setup]${NC} Checking prerequisites..."

if [ ! -f ".env" ]; then
  echo -e "${RED}❌ .env not found${NC}"
  echo "   Run: ./setup.sh"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo -e "${RED}❌ Dependencies not installed${NC}"
  echo "   Run: npm install"
  exit 1
fi

# Check if we can read .env
DB_URL=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | tr -d ' ')
if [ -z "$DB_URL" ] || [ "$DB_URL" = "postgresql://localhost/milhaslivre" ]; then
  echo -e "${YELLOW}⚠️  DATABASE_URL may not be properly configured${NC}"
  echo "   Update .env with your database credentials"
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"
echo ""

# Create cleanup function for graceful shutdown
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  wait $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}✅ Servers stopped${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start servers in parallel
echo -e "${BLUE}[Starting]${NC} Launching servers..."
echo ""

# Backend (Node.js)
echo -e "${CYAN}→ Backend server (Hono.js)${NC}"
npm run dev -w backend > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "  PID: ${BLUE}$BACKEND_PID${NC}"
echo -e "  Log: ${BLUE}tail -f /tmp/backend.log${NC}"
echo ""

# Frontend (Vite)
echo -e "${CYAN}→ Frontend server (SvelteKit/Vite)${NC}"
npm run dev -w frontend > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "  PID: ${BLUE}$FRONTEND_PID${NC}"
echo -e "  Log: ${BLUE}tail -f /tmp/frontend.log${NC}"
echo ""

# Wait for servers to start (with timeout)
echo -e "${BLUE}[Waiting]${NC} Servers starting (up to 30s)..."

BACKEND_READY=0
FRONTEND_READY=0
WAIT_TIME=0
MAX_WAIT=30

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  # Check backend
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    BACKEND_READY=1
  fi

  # Check frontend (Vite prints "Local:" when ready)
  if grep -q "Local:" /tmp/frontend.log 2>/dev/null; then
    FRONTEND_READY=1
  fi

  if [ $BACKEND_READY -eq 1 ] && [ $FRONTEND_READY -eq 1 ]; then
    break
  fi

  sleep 1
  WAIT_TIME=$((WAIT_TIME + 1))
  echo -ne "\r  Waited: ${BLUE}${WAIT_TIME}s${NC}"
done

echo ""
echo ""

# Show status
if [ $BACKEND_READY -eq 1 ]; then
  echo -e "${GREEN}✅${NC} Backend ready"
else
  echo -e "${YELLOW}⚠️ ${NC} Backend not responding (check log)"
fi

if [ $FRONTEND_READY -eq 1 ]; then
  echo -e "${GREEN}✅${NC} Frontend ready"
else
  echo -e "${YELLOW}⚠️ ${NC} Frontend not ready (check log)"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 Development Environment Ready!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""

echo -e "📱 ${CYAN}Frontend${NC}:  ${BLUE}http://localhost:5173${NC}"
echo -e "🔌 ${CYAN}Backend${NC}:   ${BLUE}http://localhost:3000${NC}"
echo -e "❤️  ${CYAN}Health${NC}:    ${BLUE}http://localhost:3000/health${NC}"
echo ""

echo -e "📝 ${CYAN}Logs:${NC}"
echo -e "   Backend:  ${BLUE}tail -f /tmp/backend.log${NC}"
echo -e "   Frontend: ${BLUE}tail -f /tmp/frontend.log${NC}"
echo ""

echo -e "🎯 ${CYAN}Available endpoints:${NC}"
echo -e "   POST   ${BLUE}/api/auth/register${NC}       - Register new user"
echo -e "   POST   ${BLUE}/api/auth/login${NC}          - Login"
echo -e "   GET    ${BLUE}/api/auth/me${NC}             - Get current user"
echo -e "   POST   ${BLUE}/api/operations${NC}          - Create operation"
echo -e "   GET    ${BLUE}/api/operations${NC}          - List operations"
echo -e "   POST   ${BLUE}/api/operations/:id/confirm${NC} - Confirm operation"
echo -e "   GET    ${BLUE}/api/operations/stats${NC}    - Dashboard stats"
echo ""

echo -e "Press ${RED}Ctrl+C${NC} to stop servers"
echo ""

# Keep running
while true; do
  # Check if processes are still running
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend crashed${NC}"
    tail -20 /tmp/backend.log
    exit 1
  fi

  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Frontend crashed${NC}"
    tail -20 /tmp/frontend.log
    exit 1
  fi

  sleep 5
done
