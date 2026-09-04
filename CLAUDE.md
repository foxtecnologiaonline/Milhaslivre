# Milhas Livre - Project Context

## 🎯 Project Overview

**Milhas Livre** is a points/miles broker MVP. The business model is to act as a middleman between sellers and buyers of airline points/miles, taking a 3-10% commission per transaction.

### Business Flow
1. Seller enters (WhatsApp/Web)
2. Inform: program, quantity, desired price
3. System generates quotation (15-min cache)
4. Find buyer (manual/list)
5. Confirm operation (atomic transaction)
6. Seller transfers points
7. Buyer pays
8. Broker receives commission (audit trail logged)

## 🏗️ Current Architecture (Optimized & Production-Ready)

### Tech Stack
- **Frontend**: SvelteKit + Vite + TypeScript
- **Backend**: Hono.js (Node.js production, not Workers-specific)
- **Database**: PostgreSQL (Railway/Render) with migrations
- **Validation**: Zod (type-safe schema validation)
- **Security**: PBKDF2 password hashing, JWT auth, rate limiting
- **Messaging**: Twilio WhatsApp (stubs ready)
- **PDF**: Contract generation (stubs ready)
- **Logging**: Structured JSON logging
- **Deployment**: Vercel (Frontend), Railway (Backend)

### Project Structure
```
packages/
├── frontend/
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable UI
│   │   ├── stores/         # Svelte stores (auth)
│   │   └── lib/            # Validators, formatters, masks
│   ├── vite.config.ts
│   └── package.json
└── backend/
    ├── src/
    │   ├── routes/         # Auth, quotations, operations
    │   ├── services/       # Twilio, PDF generation
    │   ├── middleware/     # Rate limiting
    │   ├── config.ts       # Env validation
    │   ├── db.ts          # Pooling + transactions
    │   ├── auth.ts        # JWT
    │   ├── crypto.ts      # Password hashing
    │   ├── error.ts       # Custom errors
    │   ├── logger.ts      # Structured logging
    │   ├── validators.ts  # Business logic
    │   └── index.ts       # Hono app + middleware
    ├── tests/             # Vitest suite
    ├── migrations/        # SQL (001_initial, 002_audit_trail)
    ├── wrangler.toml
    └── package.json
```

## 📊 Database Schema (Audit-Ready)

### Core Tables
1. **users** - Authentication & profiles
   - Fields: id, email, cpf, name, phone, role, password_hash (PBKDF2), verified, verified_at, deleted_at
   - Soft deletes via `deleted_at` timestamp

2. **buyers** - Corporate buyer profiles
   - Fields: id, user_id, cnpj, company_name, verified, verified_at, verification_documents (JSONB)

3. **operations** - Main business transactions (with audit trail)
   - Fields: id, seller_id, buyer_id, program, amount, price_per_thousand, commission_percentage
   - Computed: total_price, commission_amount
   - Status: 'pending', 'confirmed', 'completed', 'cancelled'
   - Audit: metadata (JSONB), deleted_at

4. **transactions** - Payment records
   - Fields: id, operation_id, amount, commission_amount, status, payment_method, payment_reference, paid_at, failed_reason

5. **quotations** - 15-minute cached price quotes

6. **audit_logs** - Comprehensive audit trail
   - Logs: user_id, resource_type, resource_id, action, old_values, new_values, ip_address, user_agent

7. **operation_state_log** - State transition tracking
   - Tracks: from_status → to_status, changed_by, changed_at, reason

8. **rate_limits** - Request throttling (in-memory in MVP)
   - Per-endpoint, per-user, sliding window

## 🔌 API Endpoints (Implemented)

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/refresh` - Exchange a refresh token for a new access token (rotates it)
- `POST /api/auth/logout` - Revoke a refresh token

### Quotations
- `GET /api/quotations` - List active quotations (Redis-cached, 10s)
- `POST /api/quotations` - Create 15-min quotation (Redis-cached for its validity window)
- `GET /api/quotations/:id` - Get specific quotation (Redis-cached)

### Operations
- `GET /api/operations` - List user's operations (protected)
- `POST /api/operations` - Create new operation (protected, notifies seller via WhatsApp)
- `POST /api/operations/:id/confirm` - Confirm operation with buyer (protected, atomic, notifies seller via WhatsApp + email)
- `GET /api/operations/stats` - Dashboard stats (protected)

### Payments
- `POST /api/payments/:operationId/checkout` - Create a Stripe checkout session for a confirmed operation (protected)
- `POST /api/payments/webhook` - Stripe webhook (signature-verified); marks the transaction/operation completed and notifies the seller

## 🎨 Frontend Pages (Implemented)

1. **Home** - Landing page with features & stats
2. **Login** - User authentication
3. **Register** - New account creation (seller/buyer choice)
4. **Dashboard** - Main app (stats, operations list, create operation)
5. **Components**:
   - QuotationForm - Get instant quotations
   - OperationsList - View all user operations
   - CreateOperation - Manually create a new operation

## ✅ What's Done (MVP Week 1 - Optimized)

**Infrastructure & Security**
- [x] Project structure & monorepo setup
- [x] Environment validation (Zod)
- [x] Database schema with migrations (001 + 002_audit_trail)
- [x] Audit trail logging (audit_logs, operation_state_log tables)
- [x] Soft deletes & data integrity
- [x] Connection pooling + transaction support
- [x] PBKDF2 password hashing (crypto.ts)
- [x] Rate limiting middleware (auth: 5/min, api: 100/min)
- [x] Structured logging system

**Backend API (Production-Ready)**
- [x] Real Node.js server entrypoint (`@hono/node-server`) — `src/index.ts` stays a portable
      Hono app export, `src/server.ts` adds the Node listener used by `npm run dev`/`start`
- [x] Hono.js with proper error handling
- [x] Custom error classes (ValidationError, AuthenticationError, etc)
- [x] JWT authentication with expiration (`exp` claim, `JWT_EXPIRY`) + signature verification
- [x] Refresh tokens: DB-backed (hashed, revocable, rotated on use), `/refresh` + `/logout`
- [x] Input validation with Zod (all endpoints)
- [x] Auth endpoints: register, login, refresh, logout, me
- [x] Quotations: create, list, get — cached in Redis with graceful in-memory fallback
- [x] Operations: create, confirm, list, stats (with audit)
- [x] Payments: Stripe checkout session + signature-verified webhook
- [x] Business validators (CPF, CNPJ, amount, commission)
- [x] Twilio WhatsApp integration (real SDK call; no-ops with a log when unconfigured)
- [x] Email notifications (SendGrid; welcome, operation confirmed, payment receipt)
- [x] PDF contract/receipt/statement generation (pdfkit, real rendered output)
- [x] Redis-backed rate limiting (falls back to in-memory when Redis is unavailable)
- [x] `scripts/migrate.js` — idempotent migration runner tracked via `schema_migrations`
- [x] Integration test suite (Hono `app.request()` + mocked DB layer, no live Postgres needed)

**Frontend (Mobile-Responsive)**
- [x] SvelteKit pages (Home, Login, Register, Dashboard, 404)
- [x] Components (QuotationForm, OperationsList, CreateOperation)
- [x] Svelte stores (auth with JWT persistence)
- [x] Input validation & formatting (CPF, CNPJ, phone masks)
- [x] Currency & date formatting
- [x] Error messages & loading states
- [x] Responsive grid layouts

**Testing & Documentation**
- [x] Auth tests (password hashing, validation)
- [x] Integration tests: auth routes (register/login/refresh) and operations routes
      (authorization rules, atomic confirm transaction) — 23 tests, mocked DB, no live Postgres
- [x] CI/CD pipeline (GitHub Actions: backend typecheck + tests, frontend build, on every push/PR)
- [x] Comprehensive README
- [x] CLAUDE.md project context
- [x] Environment example (.env.example)
- [x] SQL migrations with comments (001 initial, 002 audit trail, 003 refresh tokens)

## 🔄 Next Steps (Weeks 2-3)

### Remaining before production
- [ ] User email verification flow (send + confirm a verification code)
- [ ] Buyer company (KYC) verification workflow
- [ ] 2FA for sensitive operations
- [ ] E2E tests against a real Postgres + Redis (current suite mocks the DB layer)
- [ ] Load testing & optimization
- [ ] Production deployment (Vercel frontend, Railway/Render backend + Postgres)
- [ ] Provision real Twilio/SendGrid/Stripe credentials in the target environment —
      the integrations are implemented and no-op safely without them, so nothing breaks
      today, but notifications/payments won't actually fire until they're set

## 💻 Development Commands

```bash
# Install dependencies
npm install

# Start dev servers (both frontend & backend)
npm run dev

# Build for production
npm run build

# Run database migrations (idempotent, tracked via schema_migrations)
npm run -w backend db:migrate

# Test
npm test

# Deploy frontend to Vercel
npm run -w frontend build

# Backend runs as a real Node.js server (src/server.ts) in production —
# `npm run -w backend build && npm run -w backend start`. The optional
# `npm run -w backend deploy:workers` path targets Cloudflare Workers, but
# routes depend on `pg`/Node `crypto` and need the Supabase HTTP API swap
# noted in Known Limitations before that target is usable.
```

## 🔐 Security Checklist (Production-Ready)

**Implemented ✅**
- [x] Password hashing with PBKDF2 (crypto.ts)
- [x] Rate limiting on auth endpoints (5/min) + global API (100/min), Redis-backed with
      in-memory fallback
- [x] SQL injection protection (parameterized queries + Zod validation)
- [x] CORS properly configured (whitelist origins)
- [x] Input validation with Zod on ALL endpoints
- [x] JWT authentication with signature verification and `exp` enforcement — fixed a bug where
      `jwt-simple`'s `decode()` was called with `noVerify=true`, which skipped signature
      verification entirely; any well-formed token was accepted regardless of who signed it
- [x] Refresh tokens stored hashed (SHA-256) in the DB, rotated on every use, revocable via logout
- [x] Request logging & audit trail (audit_logs table)
- [x] Error messages don't leak sensitive info
- [x] Soft deletes (no hard deletes)
- [x] Environment variable validation
- [x] X-RateLimit headers included
- [x] Stripe webhook signature verification (`stripe.webhooks.constructEvent`)

**To Implement 🔄**
- [ ] HTTPS/TLS enforcement (deployment config)
- [ ] Email verification workflow
- [ ] 2FA for sensitive operations
- [ ] CSRF tokens for state-changing requests
- [ ] CSV injection prevention (if CSV export added)
- [ ] Database encryption at rest
- [ ] Secrets rotation policy
- [ ] IP whitelisting for sensitive endpoints

## 📝 Environment Variables

Required:
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

Optional — each integration no-ops safely (with a log line) when its variables are unset:
```
REDIS_URL=redis://...                  # cache + rate limiting; falls back to in-memory
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=no-reply@milhaslivre.com
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
FRONTEND_URL=http://localhost:5173     # used for Stripe checkout success/cancel redirects
VITE_API_URL=http://localhost:3000
```

## 📊 Performance Targets

- TTFB: <100ms (edge cache)
- API Response: <50ms
- Cache Hit Rate: >80%
- Uptime: 99.9%

## 🚀 Deployment Checklist

### Backend (Cloudflare Workers)
- [ ] Setup Cloudflare account
- [ ] Configure Workers environment
- [ ] Set production secrets
- [ ] Deploy with `wrangler deploy`

### Frontend (Vercel)
- [ ] Connect GitHub repo
- [ ] Configure environment variables
- [ ] Setup custom domain
- [ ] Enable auto-deployment

### Database (Railway/Render)
- [ ] PostgreSQL instance created
- [ ] Migrations applied
- [ ] Redis cache configured
- [ ] Backups enabled

## 🔗 Important Links

- Repository: https://github.com/foxtecnologiaonline/milhaslivre
- Branch: `claude/milhaslivre-intermediador-mvp-u65yh7`
- Vercel: (TBD)
- Cloudflare Workers: (TBD)

## 📞 Key Contacts/Notes

- Twilio SMS: ~R$ 0.05 per message
- Redis + PostgreSQL: ~R$ 20/month
- Cloudflare Workers: Free tier sufficient for MVP
- Estimated break-even: 10-20 operations

## 🎓 Code Patterns to Follow

### Backend (Hono)
```typescript
// Routes use Hono's type-safe handlers
app.get('/path', async (c) => {
  const validated = Schema.parse(c.req.json());
  return c.json(result);
});
```

### Frontend (Svelte)
```svelte
<script>
  import { onMount } from 'svelte';
  let state = $state();
</script>
```

### Database
- Use parameterized queries always
- Connection pooling via pg Pool
- Redis for quotation caching

## 📌 Known Limitations & TODOs

**Security**
- [x] JWT expiration (`exp` claim, `JWT_EXPIRY`, default 24h) — done
- [x] Refresh token endpoint (`/api/auth/refresh`, DB-backed, rotated on use) — done
- [ ] 2FA for admin operations
- [ ] Email verification workflow before account activation
- [ ] Phone verification for WhatsApp notifications

**Business Logic**
- [ ] Buyer company verification workflow (KYC)
- [x] Payment integration — Stripe checkout + webhook implemented; PagSeguro not covered
- [ ] Automatic point transfer verification
- [ ] Dispute resolution system
- [ ] Chargeback protection

**Integration**
- [x] WhatsApp Twilio SDK integration — done, no-ops when TWILIO_* is unset
- [x] PDF contract generation (pdfkit) — done
- [x] Email notifications (SendGrid) — done, AWS SES not covered
- [ ] SMS fallback notifications
- [ ] Webhook notifications for external systems (beyond the Stripe webhook)

**Production**
- [x] Redis cache implementation (quotations, rate limiting) — done, falls back to in-memory
- [ ] Database read replicas for scaling
- [ ] Cron jobs for stale operation cleanup
- [ ] Background job queue (Bull/BullMQ)
- [ ] Monitoring & alerting (Sentry, DataDog)
- [ ] Performance profiling
- [ ] Load testing suite
- [ ] Cloudflare Workers deploy target needs the `pg`/Node `crypto` routes swapped for a
      Supabase HTTP API before `deploy:workers` is production-usable (default target is
      the Node.js server in `src/server.ts`)

**Frontend**
- [ ] Offline mode with service workers
- [ ] Real-time updates (WebSockets/SSE)
- [ ] Dark mode toggle
- [ ] i18n (Portuguese/English)

---

**Last Updated**: 2026-09-04
**Status**: MVP integrations complete (Redis, Twilio, SendGrid, Stripe, JWT refresh, PDF, CI/CD) — remaining work is KYC/2FA/email-verification and live deployment
**Next Review**: After production deployment
