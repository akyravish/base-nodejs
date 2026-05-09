# Node.js Production Boilerplate

Production-ready Node.js + Express + TypeScript boilerplate. Clone, configure `.env`, and start building.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict) |
| Framework | Express.js |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache | Redis (ioredis) |
| Validation | Zod |
| Logger | Winston + morgan |
| API Docs | Swagger (swagger-ui-express) |
| Testing | Vitest + supertest |
| Linting | ESLint + Prettier |
| Containerization | Docker + Docker Compose |

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> my-project
cd my-project
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database and Redis URLs

# 3. Run database migrations
npm run db:migrate

# 4. Start development server
npm run dev
```

### Docker (recommended)

```bash
cp .env.example .env
npm run docker:dev
```

App available at `http://localhost:3000`.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript for production |
| `npm start` | Run compiled production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint and auto-fix |
| `npm run format` | Run Prettier |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:migrate:prod` | Run Prisma migrations (prod) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run docker:dev` | Start full stack via Docker Compose |
| `npm run docker:prod` | Start production stack via Docker Compose |

## Folder Structure

```
src/
├── config/
│   └── swagger.ts          # Swagger/OpenAPI config
├── lib/
│   ├── env.ts              # Zod-validated env variables
│   ├── logger.ts           # Winston logger instance
│   ├── prisma.ts           # Prisma client singleton
│   ├── redis.ts            # Redis client + cache helpers
│   └── json-response.ts    # sendSuccess / sendError helpers
├── middlewares/
│   ├── async-handler.ts    # try/catch wrapper for async routes
│   ├── error.middleware.ts # Global error handler
│   ├── notFound.ts         # 404 handler
│   ├── rate-limit.middleware.ts
│   ├── requestId.ts        # UUID per request
│   ├── requestLogger.ts    # HTTP request logging (morgan → Winston)
│   ├── security.ts         # Helmet + CORS + HPP
│   └── validate.middleware.ts
├── modules/
│   └── health/
│       ├── health.controller.ts
│       ├── health.route.ts
│       └── health.service.ts
├── types/
│   ├── errors.ts           # AppError class + subclasses
│   └── express.d.ts        # Express type augmentations
├── app.ts
└── index.ts
```

## Adding a Module

1. Create `src/modules/<name>/` with `<name>.service.ts`, `<name>.controller.ts`, `<name>.route.ts`
2. Define a Zod schema for input validation
3. Use `validate({ body: schema })` middleware on routes
4. Register the router in `src/app.ts`: `app.use('/api', yourRouter)`
5. Add `@swagger` JSDoc comments to routes for auto-generated API docs

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `DATABASE_POOL_MIN` | `2` | Prisma connection pool min |
| `DATABASE_POOL_MAX` | `10` | Prisma connection pool max |
| `REDIS_URL` | — | Redis connection string |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS origins |
| `TRUST_PROXY` | `false` | Trust X-Forwarded-For header |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `LOG_LEVEL` | `info` | Winston log level |

## API Docs

Swagger UI → `http://localhost:3000/api/docs`

## Health Check

```
GET /api/health
```

Returns live connectivity status for the database and Redis. Returns `200` when healthy, `503` when degraded.
