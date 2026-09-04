# Milhas Livre - Quick Start Guide

## ⚡ 5-Minute Setup & Execution

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or Railway/Render)
- Redis (optional, for caching)

---

## 🚀 Option 1: Using Make (Recommended)

### First Time Setup
```bash
make help              # See all available commands
make setup             # Complete first-time setup
make verify-env.sh     # Check if everything is ready
```

### Start Development Servers
```bash
make dev               # Start both frontend + backend in parallel
```

**Output:**
```
🚀 Milhas Livre - Development Server
====================================

✅ Prerequisites met

[Starting] Launching servers...

→ Backend server (Hono.js)
  PID: 12345
  Log: tail -f /tmp/backend.log

→ Frontend server (SvelteKit/Vite)
  PID: 12346
  Log: tail -f /tmp/frontend.log

✅ Development Environment Ready!

📱 Frontend:  http://localhost:5173
🔌 Backend:   http://localhost:3000
❤️  Health:    http://localhost:3000/health
```

### Other Commands
```bash
make db-migrate        # Run database migrations
make test              # Run test suite
make lint              # Lint code
make build             # Build for production
make clean             # Clean artifacts
```

---

## 🚀 Option 2: Manual Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

Required variables:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/milhaslivre
JWT_SECRET=your-secret-key-min-32-chars
ENVIRONMENT=development
```

### 3. Start Development Servers
```bash
# Terminal 1 - Backend
npm run dev -w backend

# Terminal 2 - Frontend  
npm run dev -w frontend
```

---

## 📊 Architecture Quick Reference

```
Browser (http://localhost:5173)
        ↓
    SvelteKit App (Vite dev server)
        ↓ HTTPS
    Hono.js API (http://localhost:3000)
        ↓
    PostgreSQL Database
```

---

## 🔗 Available Endpoints

### Authentication
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "João Silva",
    "cpf": "11144477735",
    "phone": "11999999999",
    "role": "seller",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# Get current user
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Operations
```bash
# Create operation (requires auth)
curl -X POST http://localhost:3000/api/operations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "program": "smiles",
    "amount": 100000,
    "pricePerThousand": 50,
    "commissionPercentage": 5
  }'

# List operations (requires auth)
curl http://localhost:3000/api/operations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get stats (requires auth)
curl http://localhost:3000/api/operations/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Quotations
```bash
# Create quotation
curl -X POST http://localhost:3000/api/quotations \
  -H "Content-Type: application/json" \
  -d '{
    "program": "smiles",
    "amount": 50000
  }'

# List quotations
curl http://localhost:3000/api/quotations

# Get specific quotation
curl http://localhost:3000/api/quotations/:id
```

---

## 📝 Database Setup

### Option A: Local PostgreSQL
```bash
# Create database
createdb milhaslivre

# Run migrations
make db-migrate

# Verify
psql -d milhaslivre -c "SELECT version();"
```

### Option B: Railway (Recommended for MVP)
```bash
# 1. Sign up at railway.app
# 2. Create PostgreSQL plugin
# 3. Copy DATABASE_URL to .env
# 4. Run: make db-migrate
```

### Option C: Render
```bash
# 1. Sign up at render.com
# 2. Create PostgreSQL database
# 3. Copy DATABASE_URL to .env
# 4. Run: make db-migrate
```

---

## 🧪 Testing

### Run All Tests
```bash
make test
```

### Backend Tests Only
```bash
npm test -w backend
```

### Test with Coverage
```bash
npm test -w backend -- --coverage
```

---

## 🔍 Debugging

### View Backend Logs
```bash
tail -f /tmp/backend.log
```

### View Frontend Logs
```bash
tail -f /tmp/frontend.log
```

### Check Backend Health
```bash
curl http://localhost:3000/health
```

### Test Database Connection
```bash
npm run -w backend db:test
```

---

## 🚀 Production Build

### Build
```bash
make build
```

### Frontend Output
```
dist/
├── index.html
├── assets/
│   ├── main-xxxxx.js
│   └── main-xxxxx.css
└── favicon.ico
```

### Deploy Frontend (Vercel)
```bash
npm run build -w frontend
# Upload dist/ folder to Vercel
```

### Deploy Backend (Railway)
```bash
# Railway auto-detects and deploys
# Ensure environment variables are set in Railway dashboard
```

---

## 📊 Performance Optimization

### Frontend
- Vite dev server: Hot Module Reloading (HMR)
- Component caching: Auto
- CSS preprocessing: Built-in

### Backend
- Connection pooling: 20 max connections
- Rate limiting: Cached in memory
- Logging: Structured JSON (async)

### Database
- Indexes: On all foreign keys & search columns
- Queries: Parameterized (no SQL injection)
- Transactions: ACID guaranteed

---

## ⚠️ Common Issues

### Issue: `DATABASE_URL not configured`
**Solution**: Update `.env` with your database URL
```env
DATABASE_URL=postgresql://user:password@localhost:5432/milhaslivre
```

### Issue: `Port 3000 already in use`
**Solution**: Kill existing process or use different port
```bash
lsof -i :3000
kill -9 <PID>
```

### Issue: Frontend can't reach backend
**Solution**: Ensure backend is running and VITE_API_URL is correct
```env
VITE_API_URL=http://localhost:3000
```

### Issue: Database connection timeout
**Solution**: Check PostgreSQL is running
```bash
psql -c "SELECT version();"
```

---

## 📚 Additional Resources

- **README.md** - Full documentation
- **ARCHITECTURE.md** - System design details
- **CLAUDE.md** - Project context
- **Hono.js Docs** - https://hono.dev
- **SvelteKit Docs** - https://kit.svelte.dev

---

## 🎯 Next Steps

### Done
- [x] Redis caching (quotations + rate limiting, falls back to in-memory)
- [x] WhatsApp integration (Twilio)
- [x] PDF contract generation (pdfkit)
- [x] Email notifications (SendGrid)
- [x] Payment processor integration (Stripe checkout + webhook)
- [x] JWT expiration + refresh tokens
- [x] CI/CD pipeline (GitHub Actions)

### Remaining before production
- [ ] Buyer company verification (KYC)
- [ ] Email verification flow
- [ ] 2FA for sensitive operations
- [ ] Production deployment + real Twilio/SendGrid/Stripe credentials

### Month 2+
- [ ] Real-time updates (WebSockets)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics

---

## 💡 Tips & Tricks

### Fast Restart
```bash
# Terminal 1: Kill servers
Ctrl+C

# Terminal 1: Restart
make dev
```

### Code Formatting
```bash
npm run format -w frontend
npm run format -w backend
```

### Database Inspector
```bash
psql -d milhaslivre
```

### API Testing with curl
```bash
# Save JWT token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}' \
  | jq -r '.token')

# Use token in requests
curl http://localhost:3000/api/operations \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 📞 Support

- **Issues?** Check logs: `tail -f /tmp/backend.log`
- **Questions?** Read ARCHITECTURE.md
- **Errors?** Verify with `make verify-env.sh`

---

**Status**: ✅ Ready for Development  
**Last Updated**: 2026-08-31  
**Version**: 0.1.0 MVP
