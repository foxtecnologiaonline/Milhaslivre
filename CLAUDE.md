# Milhas Livre - Project Context

## 🎯 Project Overview

**Milhas Livre** is a points/miles broker MVP. The business model is to act as a middleman between sellers and buyers of airline points/miles, taking a 3-10% commission per transaction.

### Business Flow
1. Seller enters (WhatsApp)
2. Inform: program, quantity, desired price
3. System generates quotation
4. Find buyer (manual/list)
5. Confirm operation
6. Seller transfers points
7. Buyer pays
8. Broker receives commission

## 🏗️ Current Architecture

### Tech Stack
- **Frontend**: SvelteKit + Vite + TypeScript
- **Backend**: Hono.js on Cloudflare Workers
- **Database**: PostgreSQL (Railway/Render)
- **Cache**: Redis (Railway)
- **Messaging**: Twilio (WhatsApp integration)
- **Deployment**: Vercel (Frontend), Cloudflare Workers (Backend)

### Project Structure
```
packages/
├── frontend/          # SvelteKit application
│   ├── src/
│   │   ├── pages/     # Home, Login, Register, Dashboard, NotFound
│   │   ├── components/ # QuotationForm, OperationsList, CreateOperation
│   │   └── stores/    # auth (Svelte stores)
│   ├── vite.config.ts
│   └── package.json
└── backend/           # Hono.js API
    ├── src/
    │   ├── routes/    # auth, quotations, operations
    │   ├── db.ts      # PostgreSQL connection + query helpers
    │   ├── auth.ts    # JWT generation & verification
    │   └── index.ts   # Main Hono app
    ├── migrations/    # 001_initial_schema.sql
    ├── wrangler.toml  # Cloudflare Workers config
    └── package.json
```

## 📊 Database Schema

### Core Tables
1. **users** - Authentication & user profiles
   - Roles: 'seller', 'buyer', 'admin'
   - Fields: id, email, cpf, name, phone, role, password_hash, verified

2. **buyers** - Corporate buyer profiles
   - Fields: id, user_id, cnpj, company_name, verified, phone, email

3. **operations** - Main business transactions
   - Fields: id, seller_id, buyer_id, program, amount, price_per_thousand
   - Computed: total_price, commission_amount
   - Status: 'pending', 'confirmed', 'completed', 'cancelled'

4. **transactions** - Payment records
   - Fields: id, operation_id, amount, commission_amount, status, paid_at

5. **quotations** - 15-minute cached price quotes
   - Used for form pre-fills and quick pricing

## 🔌 API Endpoints (Implemented)

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `GET /api/auth/me` - Get current user (requires auth)

### Quotations
- `GET /api/quotations` - List active quotations
- `POST /api/quotations` - Create 15-min quotation
- `GET /api/quotations/:id` - Get specific quotation

### Operations
- `GET /api/operations` - List user's operations (protected)
- `POST /api/operations` - Create new operation (protected)
- `POST /api/operations/:id/confirm` - Confirm operation with buyer (protected)
- `GET /api/operations/stats` - Dashboard stats (protected)

## 🎨 Frontend Pages (Implemented)

1. **Home** - Landing page with features & stats
2. **Login** - User authentication
3. **Register** - New account creation (seller/buyer choice)
4. **Dashboard** - Main app (stats, operations list, create operation)
5. **Components**:
   - QuotationForm - Get instant quotations
   - OperationsList - View all user operations
   - CreateOperation - Manually create a new operation

## ✅ What's Done (MVP Week 1)

- [x] Project structure & monorepo setup
- [x] Database schema with migrations
- [x] Backend API with Hono.js (all core endpoints)
- [x] Authentication system (JWT)
- [x] Frontend pages & components (SvelteKit)
- [x] Auth store & state management
- [x] Responsive UI design
- [x] Environment configuration

## 🔄 Next Steps (Weeks 2-3)

### Week 2: Production Ready & Integration
- [ ] Implement bcrypt password hashing (replace plain text)
- [ ] Add error handling & validation layer
- [ ] Setup database connection pooling
- [ ] Cache integration (Redis layer)
- [ ] PDF contract generation
- [ ] User verification email flow
- [ ] Buyer company verification workflow

### Week 3: WhatsApp & Testing
- [ ] Twilio WhatsApp integration
- [ ] Webhook handlers for WhatsApp messages
- [ ] Automated notifications (pending ops, payments)
- [ ] Unit tests (backend)
- [ ] E2E tests (critical flows)
- [ ] CI/CD pipeline setup
- [ ] Production deployment
- [ ] Load testing & optimization

## 💻 Development Commands

```bash
# Install dependencies
npm install

# Start dev servers (both frontend & backend)
npm run dev

# Build for production
npm run build

# Run database migrations
npm run -w backend db:migrate

# Test
npm test

# Deploy backend to Cloudflare
npm run -w backend deploy

# Deploy frontend to Vercel
npm run -w frontend build
```

## 🔐 Security Checklist

- [ ] Password hashing with bcrypt
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS/TLS enforcement
- [ ] CORS properly configured
- [ ] SQL injection protection (using parameterized queries ✅)
- [ ] JWT token expiration & refresh
- [ ] Secure session management
- [ ] Input validation & sanitization
- [ ] CSV injection prevention
- [ ] CSRF protection

## 📝 Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret-key
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
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

## 📌 Known Limitations

1. **Password hashing**: Currently stored as plain text - must implement bcrypt ASAP
2. **Email verification**: Not yet implemented
3. **Buyer verification**: Manual process - needs workflow
4. **Payment integration**: Stubbed out - needs real payment processor
5. **WhatsApp**: Not yet integrated
6. **Rate limiting**: Not implemented
7. **Logging**: Basic console only

---

**Last Updated**: 2026-08-31
**Status**: MVP Core Infrastructure Complete
**Next Review**: After Week 2 integration work
