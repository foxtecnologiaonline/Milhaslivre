# Milhas Livre - Intermediador MVP

Corretora de pontos/milhas. Você não compra, apenas intermedia vendedor → comprador. Ganha 3-10% comissão por operação.

## 🎯 Modelo de Negócio

- **Vendedor**: 100k pontos Smiles → quer vender por R$ 50/mil
- **Preço**: 100k × R$ 50 / 1000 = R$ 5.000
- **Sua comissão (5%)**: R$ 250
- Você procura comprador, cobra R$ 5.000, repassa R$ 4.750

## 🏗️ Tech Stack

- **Frontend**: SvelteKit
- **Backend**: Hono.js (Cloudflare Workers)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Messaging**: Twilio (WhatsApp)
- **CDN**: Cloudflare

## 📊 Arquitetura

```
milhaslivre/
├── packages/
│   ├── frontend/          # SvelteKit app
│   │   ├── src/
│   │   │   ├── pages/     # Page components
│   │   │   ├── components/ # Reusable components
│   │   │   └── stores/    # Svelte stores (auth, state)
│   │   └── vite.config.ts
│   └── backend/           # Hono.js API
│       ├── src/
│       │   ├── routes/    # API endpoints
│       │   ├── db.ts      # Database layer
│       │   └── auth.ts    # Auth utilities
│       ├── migrations/    # SQL migrations
│       └── wrangler.toml  # Cloudflare config
└── package.json           # Monorepo root
```

## 📋 MVP Features

- ✅ **Landing page** (Vercel)
- ✅ **Formulário de cotação** (SvelteKit)
- ✅ **Dashboard admin** (listar operações, status)
- 🔄 **WhatsApp integration** (notificações)
- 🔄 **CRM básico** (lista compradores)
- 🔄 **Contrato digital PDF**
- ✅ **Autenticação simples** (JWT)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Database setup
npm run -w backend db:migrate

# Development
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3000

### Database

The project uses PostgreSQL with migrations in `packages/backend/migrations/`.

To apply migrations:
```bash
npm run -w backend db:migrate
```

### API Endpoints

#### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (protected)

#### Quotations
- `GET /api/quotations` - List quotations
- `POST /api/quotations` - Create quotation (15min cache)
- `GET /api/quotations/:id` - Get quotation details

#### Operations
- `GET /api/operations` - List user operations (protected)
- `POST /api/operations` - Create operation (protected)
- `POST /api/operations/:id/confirm` - Confirm operation (protected)
- `GET /api/operations/stats` - Dashboard stats (protected)

## 📈 Performance Targets

- TTFB: <100ms (edge cache)
- API: <50ms (Redis)
- Cache hit: >80%
- Uptime: 99.9%

## 💰 Infra Costs

- PostgreSQL (Railway/Render): R$ 15/mês
- Redis (Railway): R$ 5/mês
- Cloudflare Workers: R$ 0 (free tier)
- Vercel (frontend): R$ 0 (hobby)
- Twilio (WhatsApp): ~R$ 0.05 por mensagem

**Total: R$ 50-100/mês**

## 📅 Timeline

- **Semana 1**: Setup infra + DB + API skeleton ✅
- **Semana 2**: Frontend (landing + formulário + dashboard)
- **Semana 3**: WhatsApp + integração + testes
- **Deploy**: Fim de semana 3

**Total: 3 semanas, ~40h dev**

## 💡 ROI Projection

- **Investimento**: R$ 1-5k (infra + tempo)
- **Break-even**: 10-20 operações (~R$ 2.5-5k comissão)
- **Esperado mês 1**: R$ 5-20k (validação)

## 🔐 Security

- JWT authentication
- Password hashing (bcrypt) - TODO in production
- HTTPS/TLS enforcement
- CORS configured
- SQL injection protection via parameterized queries

## 📝 Database Schema

### users
```sql
id, email, cpf, name, phone, role, password_hash, verified, created_at, updated_at
```

### buyers
```sql
id, user_id, cnpj, company_name, verified, phone, email, created_at, updated_at
```

### operations
```sql
id, seller_id, buyer_id, program, amount, price_per_thousand,
commission_percentage, total_price, commission_amount, status, created_at, updated_at
```

### transactions
```sql
id, operation_id, amount, commission_amount, status, paid_at, created_at, updated_at
```

## 🔄 Deployment

### Frontend (Vercel)
```bash
npm run build -w frontend
# Push to GitHub for auto-deploy
```

### Backend (Cloudflare Workers)
```bash
npm run deploy -w backend
```

## 🧪 Testing

```bash
npm test
```

## 📞 Support

- WhatsApp Integration: Twilio
- Contact: support@milhaslivre.com

## 📄 License

MIT
