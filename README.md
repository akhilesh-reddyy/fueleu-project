# FuelEU Maritime Compliance Platform

Full-stack compliance dashboard implementing the FuelEU Maritime Regulation (EU) 2023/1805, covering Compliance Balance (CB) calculation, banking (Article 20), and pooling (Article 21).

---

## Architecture

Both the backend and frontend follow **Hexagonal Architecture** (Ports & Adapters):

```
core/
  domain/        Pure TypeScript entities — all business logic lives here
  application/   Use-cases, ports (interfaces), DTOs — orchestration only
adapters/
  inbound/       HTTP controllers (Express) — translate HTTP → use-case
  outbound/      Repository implementations (Prisma/PostgreSQL)
infrastructure/  Server bootstrap, DB client, composition root (DI wiring)
```

**Dependency rule:** arrows only point inward. `core` imports nothing outside itself. Express and Prisma only appear in `adapters/` and `infrastructure/`.

---

## Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Backend    | Node.js 20 · TypeScript 5 · Express 4        |
| Database   | PostgreSQL 16 · Prisma 5                     |
| Frontend   | React 18 · TypeScript 5 · Vite 5             |
| Styling    | Tailwind CSS 3 · Framer Motion 11            |
| Charts     | Recharts 2                                   |
| Testing    | Jest 29 · ts-jest · Supertest                |

---

## Project Structure

```
fueleu-project/
├── backend/
│   ├── src/
│   │   ├── core/
│   │   │   ├── domain/domain.ts          # Route, ComplianceBalance, BankEntry, Pool
│   │   │   └── application/application.ts # Use-cases, ports, DTOs, mappers
│   │   ├── adapters/
│   │   │   ├── inbound/http/http.ts       # Express controllers + router
│   │   │   └── outbound/postgres/         # Repository implementations
│   │   └── infrastructure/
│   │       ├── db/prismaClient.ts
│   │       └── server/server.ts           # Composition root
│   ├── tests/
│   │   ├── domain.test.ts                 # Unit tests (CB + Pool)
│   │   └── http.integration.test.ts       # Integration tests (Supertest)
│   ├── prisma/schema.prisma
│   ├── schema.sql
│   ├── seed.sql
│   ├── jest.config.js
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── core/
│   │   │   ├── domain/domain.ts           # Domain constants (FUEL_EU)
│   │   │   └── application/application.ts # Shared DTO types
│   │   ├── adapters/
│   │   │   ├── infrastructure/api/        # API client functions
│   │   │   └── ui/tabs/                   # Tab pages + hooks
│   │   ├── components/
│   │   │   ├── layout/                    # Sidebar, DashboardLayout
│   │   │   └── ui/                        # Button, Card, Badge, Tabs
│   │   ├── types/
│   │   ├── lib/utils.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── tsconfig.json
├── README.md
├── AGENT_WORKFLOW.md
└── REFLECTION.md
```

---

## Setup & Run

### Prerequisites

- Node.js ≥ 20
- PostgreSQL 16 running locally (or Docker)
- pnpm or npm

### Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL=postgresql://user:pass@localhost:5432/fueleu

# Apply schema
psql -d fueleu < schema.sql

# Seed data (5 routes, R001 as baseline)
psql -d fueleu < seed.sql

# Or use Prisma migrations
npx prisma migrate dev --name init
npx prisma db seed

# Start dev server (port 4000)
npm run dev
```

### Frontend

```bash
cd frontend

npm install

# Start dev server (port 5173)
npm run dev
```

Open `http://localhost:5173`. The frontend proxies API calls to `http://localhost:4000/api/v1`.

---

## API Reference

| Method | Path                         | Description                              |
|--------|------------------------------|------------------------------------------|
| GET    | `/api/v1/routes`             | List all routes (filters: year, vesselType, fuelType) |
| GET    | `/api/v1/routes/comparison`  | Baseline vs fleet comparison (query: year) |
| POST   | `/api/v1/routes/:id/baseline`| Promote route to baseline                |
| GET    | `/api/v1/compliance/cb`      | Compute CB (query: shipId, routeId, year) |
| GET    | `/api/v1/compliance/adjusted-cb` | CB after banking (query: shipId, year) |
| GET    | `/api/v1/banking/records`    | List bank entries (query: shipId, year)  |
| POST   | `/api/v1/banking/bank`       | Bank surplus CB                          |
| POST   | `/api/v1/banking/apply`      | Apply banked credits to deficit          |
| POST   | `/api/v1/pools`              | Create compliance pool                   |
| GET    | `/health`                    | Liveness probe                           |

### CB Formula

```
Energy (MJ)  = fuelConsumption (t) × 41,000 MJ/t
CB (gCO₂e)   = (89.3368 − ghgIntensity) × Energy
CB > 0  →  Surplus  (bankable under Art. 20)
CB < 0  →  Deficit  (remediation required)
```

---

## Running Tests

```bash
cd backend

# All tests
npm test

# Unit tests only (domain entities)
npm run test:unit

# Integration tests only (HTTP endpoints)
npm run test:integration

# With coverage report
npm run test:coverage
```

Test count: **82 assertions** across 40 unit tests and 42 integration tests.

---

## Seed Data

| Route | Vessel      | Fuel | Year | GHG (gCO₂e/MJ) | Baseline |
|-------|-------------|------|------|----------------|----------|
| R001  | Container   | HFO  | 2024 | 91.0           | ✓        |
| R002  | BulkCarrier | LNG  | 2024 | 88.0           | —        |
| R003  | Tanker      | MGO  | 2024 | 93.5           | —        |
| R004  | RoRo        | HFO  | 2025 | 89.2           | —        |
| R005  | Container   | LNG  | 2025 | 90.5           | —        |

Target intensity (2025): **89.3368 gCO₂e/MJ** (2% below 91.16 reference)

---

## Regulation Reference

- **(EU) 2023/1805** — FuelEU Maritime Regulation
- **Annex IV** — CB formula and energy calculation
- **Article 20** — Banking (surplus CB storage and application)
- **Article 21** — Pooling (compliance balance sharing across ships)
