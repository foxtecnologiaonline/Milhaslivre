# Marketplace Multi-Vendedor

Marketplace multi-vendedor (referências de comportamento: Amazon.com.br, Magalu,
Mercado Livre, Shopee). Nome ainda não decidido entre **Milhas-Livre** e
**Mart-Milhas**.

Stack: NestJS (modular monolith) + PostgreSQL + Redis/BullMQ + Meilisearch +
Next.js + Pagar.me + Melhor Envio.

Contexto de arquitetura, backlog e regras de engenharia: ver [`CLAUDE.md`](./CLAUDE.md).

## Quickstart

```bash
cp .env.example .env
npm install
npm run docker:up      # Postgres + Redis
npm run dev             # apps/api (NestJS) em :3000 + apps/web (Next.js) em :3001
```

## Estrutura

```
apps/
├── api/    # NestJS — API do marketplace (modular monolith)
└── web/    # Next.js — storefront
docker-compose.yml
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe `api` e `web` em modo desenvolvimento |
| `npm run build` | Build de produção de `api` e `web` |
| `npm run lint` | Lint de `api` e `web` |
| `npm test` | Testes unitários de `api` e `web` |
| `npm run docker:up` / `docker:down` | Sobe/derruba Postgres + Redis locais |
