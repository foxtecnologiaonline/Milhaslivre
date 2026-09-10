# Projeto: Marketplace Multi-Vendedor

> Nome ainda não decidido entre **Milhas-Livre** e **Mart-Milhas**. Este repositório
> substitui o MVP anterior de corretor de milhas P2P (Hono.js + SvelteKit) — aquele
> projeto foi descontinuado em favor deste escopo.

Stack fixa: NestJS + PostgreSQL + Redis/BullMQ + Meilisearch + Next.js + Pagar.me
(split via `recipient_id`) + Melhor Envio (frete).

Arquitetura: Modular Monolith, 1 schema por módulo, comunicação entre módulos SEMPRE
via interface de serviço + evento de domínio (nunca import direto de repositório de
outro módulo). Boundary de módulo = boundary de futuro microserviço.

Regra de negócio central: **1 `Order` comprado de N sellers → N `SubOrder`
independentes**, cada um com pagamento (split), frete e status de ciclo de vida
próprios. O comprador vê o `Order` consolidado; o seller vê só seu(s) `SubOrder`.

## Estrutura do monorepo

```
apps/
├── api/    # NestJS — modular monolith (1 módulo por bounded context)
└── web/    # Next.js — storefront
docker-compose.yml   # Postgres + Redis (dev local)
```

Cada bounded context (`identity`, `seller`, `catalog`, `inventory`, `cart`,
`checkout`, `payments`, `orders`, `shipping`, `reviews`) vira um módulo Nest sob
`apps/api/src/<modulo>/`, com schema Postgres próprio (`<modulo>.*`). Nenhum módulo
lê tabela de outro módulo diretamente — só via serviço exposto (ex.: `catalog`
resolve o seller aprovado chamando `SellerService.getApprovedSellerForUser`,
exportado por `SellerModule`, em vez de consultar `seller.sellers`).

Migrations ficam em `apps/api/migrations/<NN-modulo>/<NNN_descrição>.sql` — o
prefixo `NN-` no nome do diretório do módulo (`01-identity`, `02-seller`,
`03-catalog`, ...) mantém a ordem de aplicação alinhada à ordem de dependência do
backlog (ex.: `catalog.offers` tem FK para `seller.sellers`, então `seller`
precisa migrar antes).

## Backlog ativo (ordem fixa — seguir a seção 3 do escopo de engenharia)

1. [x] Monorepo + Docker Compose (Postgres, Redis) + CI (lint + test) rodando verde
2. [x] Módulo `identity`: registro/login/JWT + RBAC (`buyer`, `seller`, `admin`)
3. [x] Módulo `seller`: onboarding + aprovação por admin
4. [x] Módulo `catalog`: produto + oferta + categoria, com testes de criação/consulta
5. [x] Módulo `inventory`: reserva/liberação de estoque atômica (lock otimista)
6. [x] Módulo `cart`: carrinho persistido por buyer, agregando ofertas de múltiplos sellers
7. [ ] Módulo `checkout`: transforma carrinho em `Order` + `SubOrder`s, sem cobrar ainda
8. [ ] Módulo `payments`: gateway (Pagar.me), split por `SubOrder`, webhook idempotente
9. [ ] Módulo `shipping`: cotação de frete por `SubOrder` no checkout + etiqueta pós-pagamento
10. [ ] Módulo `orders`: status por `SubOrder` (pending → paid → shipped → delivered), evento por transição
11. [ ] Módulo `reviews`: liberado só após `delivered`
12. [ ] Storefront Next.js: home, busca, página de produto, carrinho, checkout
13. [ ] Painel seller: cadastro de produto, listagem de pedidos
14. [ ] Painel admin: aprovação de seller, moderação de catálogo

Nada da Fase 4/5 (cupom, chat, recomendação, disputa, fulfillment) entra antes do
item 14 estar em produção. Uma tarefa do backlog = um PR.

## Regras de engenharia não-negociáveis

- Toda tarefa exige teste automatizado (caminho feliz + 1 caminho de erro) antes de
  ser considerada concluída.
- Todo endpoint que move dinheiro ou estoque é **idempotente** (chave de idempotência
  no header).
- Toda transição de status de `SubOrder`/`Payment` emite um evento de domínio — mesmo
  dentro do monolito.
- Nenhum módulo lê tabela de outro módulo diretamente; só via serviço exposto.
- Toda tabela financeira é **append-only para auditoria** (sem UPDATE destrutivo em
  `split_transactions`).
- LGPD: dado pessoal de `buyer`/`seller` isolado em schema próprio, nunca em log.

## Contratos de API mínimos por módulo

| Módulo | Endpoints obrigatórios no MVP |
|---|---|
| `identity` | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /me` |
| `seller` | `POST /sellers`, `GET /sellers/:id`, `PATCH /sellers/:id/status` (admin) |
| `catalog` | `POST /products`, `GET /products/:id`, `GET /products?query=`, `POST /products/:id/offers` |
| `inventory` | `POST /offers/:id/reserve`, `POST /offers/:id/release`, `PATCH /offers/:id/stock` |
| `cart` | `POST /cart/items`, `GET /cart`, `DELETE /cart/items/:id` |
| `checkout` | `POST /checkout` → cria `Order` + N `SubOrder` |
| `payments` | `POST /payments/charge`, `POST /payments/webhook` (assíncrono, idempotente) |
| `orders` | `GET /orders/:id`, `GET /sellers/:id/orders`, `PATCH /suborders/:id/status` |
| `shipping` | `POST /shipping/quote`, `POST /shipping/label`, `GET /shipping/:id/tracking` |
| `reviews` | `POST /reviews` (apenas se `order.status = delivered`), `GET /products/:id/reviews` |

## Modelo de dados (mínimo, não exaustivo)

```sql
-- catalog
products(id, title, description, category_id, brand, attributes jsonb, created_at)
offers(id, product_id, seller_id, price_cents, stock, condition, sla_days, is_buybox_winner bool)

-- orders (um Order vira N SubOrder — regra inegociável)
orders(id, buyer_id, total_cents, status, created_at)
sub_orders(id, order_id, seller_id, subtotal_cents, shipping_cents, status)
order_items(id, sub_order_id, offer_id, qty, unit_price_cents)

-- payments
payments(id, order_id, gateway_id, status, method, total_cents)
split_transactions(id, payment_id, seller_id, amount_cents, fee_cents, status)

-- shipping
shipments(id, sub_order_id, carrier, tracking_code, status, eta)

-- reviews
reviews(id, order_item_id, author_id, target_type enum('product','seller'), rating, comment)
```

Nota Pagar.me: cada `seller` precisa de um `recipient_id` cadastrado no gateway no
momento da aprovação (item 3 do backlog). `split_transactions.amount_cents` é um
espelho local do split que o Pagar.me já calcula na criação da transação — serve
para auditoria/conciliação, não para recalcular o split.

## Comandos de desenvolvimento

```bash
npm install                 # instala as dependências dos workspaces (apps/api, apps/web)
npm run docker:up           # sobe Postgres + Redis (docker-compose.yml)
npm run dev                 # roda api (NestJS) + web (Next.js) em paralelo
npm run lint                # lint em api e web
npm test                    # testes unitários em api e web
npm run build                # build de produção em api e web
```

## Estado atual

- [x] Item 1 do backlog: monorepo (npm workspaces), `apps/api` (NestJS) e `apps/web`
      (Next.js) com lint + testes configurados, `docker-compose.yml` (Postgres +
      Redis) e CI (GitHub Actions) rodando lint + test em ambos os apps.
- [x] Item 2 do backlog: módulo `identity` — `POST /auth/register`,
      `POST /auth/login`, `POST /auth/refresh`, `GET /me`. JWT (`@nestjs/jwt` +
      `passport-jwt`), RBAC via `Roles`/`RolesGuard`, senha com PBKDF2, refresh
      token hashado (SHA-256) e rotacionado a cada uso. Migration
      `migrations/identity/001_create_users.sql` (schema `identity`, tabelas
      `users` e `refresh_tokens`). Testes: unitários do `IdentityService`
      (repositório em memória) + e2e via supertest (repositório em memória) —
      caminho feliz e de erro cobertos em cada endpoint. Validado manualmente
      ponta a ponta contra um Postgres real local.
- [x] Item 3 do backlog: módulo `seller` — `POST /sellers` (onboarding, role
      `seller`, um perfil por usuário), `GET /sellers/:id` (público),
      `PATCH /sellers/:id/status` (admin, aprova/rejeita um seller `pending`,
      motivo obrigatório ao rejeitar). Migration
      `migrations/seller/001_create_sellers.sql` (schema `seller`,
      `sellers.user_id` com FK para `identity.users`). Testes: unitários do
      `SellerService` + e2e via supertest (repositório em memória) — caminho
      feliz e erros (perfil duplicado, não encontrado, decisão já tomada,
      papel/role sem permissão) cobertos. Validado manualmente ponta a ponta
      contra um Postgres real, o que revelou e corrigiu um bug real: IDs
      malformados na rota `:id` batiam direto no Postgres e estouravam 500 em
      vez de 404 — corrigido com `ParseUUIDPipe` (retorna 400 para IDs mal
      formados, 404 para IDs válidos que não existem).
- [x] Item 4 do backlog: módulo `catalog` — `POST /products` (role `seller`/`admin`),
      `GET /products?query=` (busca por título via `ILIKE`, sem Meilisearch ainda),
      `GET /products/:id` (retorna o produto com suas `offers`, ordenadas por
      preço), `POST /products/:id/offers` (só sellers aprovados — chama
      `SellerService.getApprovedSellerForUser`, demonstrando a regra de
      comunicação entre módulos via serviço exposto). Migration
      `migrations/03-catalog/001_create_catalog.sql` (schema `catalog`, tabelas
      `categories` — com um seed inicial, sem endpoint de gestão ainda —,
      `products` e `offers`; `offers.seller_id` com FK para `seller.sellers`).
      Testes: unitários do `CatalogService` + e2e via supertest — caminho feliz
      e erros (categoria inexistente, produto inexistente, seller não aprovado,
      role sem permissão, ID malformado) cobertos. Validado manualmente ponta a
      ponta contra um Postgres real (onboarding → tentativa de oferta bloqueada
      → aprovação → oferta criada → produto com ofertas → busca).
- [x] Item 5 do backlog: módulo `inventory` — `POST /offers/:id/reserve`
      (qualquer usuário autenticado), `POST /offers/:id/release` (libera uma
      reserva `active` específica por `reservationId`),
      `PATCH /offers/:id/stock` (admin, ou o seller dono da oferta). O contador
      `stock` continua em `catalog.offers` (owned pelo módulo `catalog`, como no
      schema da seção 2); `inventory` só possui a trilha de reservas
      (`inventory.reservations`) e chama de volta `CatalogService.reserveOfferStock`
      /`releaseOfferStock`/`setOfferStock` para mutar o estoque — nunca lê/escreve
      `catalog.offers` diretamente. A concorrência é resolvida com um único
      `UPDATE catalog.offers SET stock = stock - $qty WHERE stock >= $qty` — o
      `WHERE` funciona como a checagem otimista (CAS): ou o decremento e a
      validação acontecem atomicamente, ou a operação falha porque a
      precondição não vale mais. Migration
      `migrations/04-inventory/001_create_reservations.sql`. Testes: unitários
      do `InventoryService` (reservar acima do estoque, liberar duas vezes,
      seller tentando mexer no estoque de outro seller) + e2e via supertest.
      Validado manualmente ponta a ponta contra um Postgres real.
- [x] Item 6 do backlog: módulo `cart` — `POST /cart/items` (upsert: mesma
      oferta soma quantidade em vez de duplicar linha),
      `GET /cart` (itens do buyer autenticado, cada um enriquecido com a
      `offer` via `CatalogService.getOfferById`), `DELETE /cart/items/:id`
      (204, só o dono do item pode remover). Restrito ao role `buyer`. Não
      valida estoque no momento de adicionar ao carrinho — isso é
      responsabilidade do `checkout`/`inventory` no momento da compra; o
      carrinho é só uma lista de intenção. Migration
      `migrations/05-cart/001_create_cart_items.sql` (schema `cart`, uma
      linha por `(buyer_id, offer_id)`, sem uma tabela `carts` separada — o
      carrinho de um buyer é o conjunto de `cart_items` com seu `buyer_id`).
      Testes: unitários do `CartService` + e2e via supertest — caminho feliz,
      merge de quantidade, oferta inexistente, isolamento entre buyers, role
      sem permissão. Validado manualmente ponta a ponta contra um Postgres
      real.
- [ ] Itens 7–14: pendentes.

Infra compartilhada criada junto do item 2 (reaproveitável pelos próximos
módulos): `ConfigModule` com validação Zod de env vars (`src/config/env.schema.ts`),
`DatabaseModule` expondo um `pg.Pool` global (`src/database/database.module.ts`,
token `PG_POOL`), e um runner de migração idempotente
(`scripts/migrate.js` → `npm run db:migrate -w apps/api`, migrations em
`migrations/<módulo>/*.sql`, tracked via `public.schema_migrations`). CI roda as
migrations contra um serviço Postgres antes dos testes.

**Última atualização**: 2026-09-10
