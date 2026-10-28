# market-platform

Monorepo da plataforma SaaS para mercadinhos autônomos (backend e painel). O app Android fica no repositório `market-android`.

## Estado atual — Sprint 01 (Fundação)

API NestJS com autenticação, RBAC, multi-tenancy, operadores, usuários e mercadinhos.

| Endpoint (`/api/v1`)                     | Quem acessa                                   |
| ---------------------------------------- | --------------------------------------------- |
| `POST /auth/login`, `/refresh`, `/logout` | público (com rate limit)                     |
| `POST /organizations`, `GET /organizations` | `PLATFORM_ADMIN`                           |
| `GET /organizations/current`             | qualquer membro do operador                   |
| `POST /users`, `GET /users`, `GET /users/:id` | `OPERATOR_OWNER`, `OPERATOR_ADMIN`       |
| `GET /users/me`                          | qualquer usuário autenticado                  |
| `POST /stores`                           | `OPERATOR_OWNER`, `OPERATOR_ADMIN`            |
| `GET /stores`, `GET /stores/:id`         | membros; gerente/estoquista só veem unidades vinculadas |
| `PATCH /stores/:id`                      | owner, admin, `STORE_MANAGER` (unidades vinculadas) |
| `GET/POST/DELETE /stores/:id/members`    | owner, admin (GET também gerente)             |
| `GET /health`                            | público                                       |

Documentação OpenAPI em `/api/docs` (JSON em `/api/docs-json`).

### Como o isolamento funciona

- O operador da requisição vem do access token e é **revalidado no banco a cada requisição** (usuário ativo, vínculo existente, operador ativo). Nenhuma rota aceita `organizationId` do cliente; campos extras no corpo retornam 400.
- Todas as consultas de serviço filtram por `organizationId` da sessão; recurso de outro operador responde 404 (não revela existência).
- No banco, `store_memberships` tem FKs compostas para `stores(id, organization_id)` e `memberships(user_id, organization_id)`: é impossível vincular loja e usuário de operadores diferentes, mesmo com bug na aplicação.
- Refresh tokens rotativos com detecção de reutilização (reapresentar um token já usado revoga a família inteira).
- `audit_logs` é somente inserção (trigger bloqueia UPDATE/DELETE).

## Rodando localmente

Requisitos: Node 22.12+ (recomendado 24), pnpm, Docker (para o banco de desenvolvimento).

```bash
pnpm install
pnpm db:up
cp apps/api/.env.example apps/api/.env   # ajuste JWT_ACCESS_SECRET
pnpm --filter @market/api prisma:migrate
pnpm --filter @market/api db:seed        # cria o PLATFORM_ADMIN do .env
pnpm dev
```

## Testes

```bash
pnpm test        # unitários
pnpm test:e2e    # E2E contra PostgreSQL real
```

Sem `TEST_DATABASE_URL`, os E2E sobem um PostgreSQL embutido temporário (não precisa de Docker). Com ela definida (CI, ou `postgresql://market:market@localhost:5432/market_test` do docker compose), usam esse banco. **Os E2E truncam as tabelas**: nunca aponte para o banco de desenvolvimento.

## Próximos passos

- ORG-02: convites (hoje o cadastro de usuário define a senha diretamente; e-mail já existente retorna 409).
- PostgreSQL Row-Level Security como segunda camada de isolamento.
- ESLint/Prettier compartilhados em `packages/config`.
- `apps/web` (Next.js) e `apps/worker` (BullMQ).
