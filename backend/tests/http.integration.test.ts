// =============================================================================
// Integration Tests — HTTP Layer
// Tests: /routes, /banking, /pools endpoints
// Runner: Jest + Supertest
// Strategy: real Express app + in-memory stub implementations of all ports
// Zero database, zero Prisma — tests are deterministic and self-contained
// =============================================================================

import request from "supertest";
import type { Application } from "express";
import { createApp }         from "../src/adapters/inbound/http/http";
import {
  Route,
  ComplianceBalance,
  BankEntry,
  Pool,
  FUEL_EU,
} from "../src/core/domain/domain";
import {
  ListRoutes,
  SetBaseline,
  GetComparison,
  ComputeComplianceBalance,
  GetAdjustedCB,
  ListBankRecords,
  BankSurplus,
  ApplyBankedCompliance,
  CreatePool,
  type IRouteRepository,
  type IComplianceRepository,
  type IBankRepository,
  type IPoolRepository,
  type IIdGenerator,
  type IComplianceUseCases,
  type RouteFilters,
  type CBSnapshot,
} from "../src/core/application/application";

// =============================================================================
// SECTION 1 — In-memory stub repositories
// Implement every port interface using plain Maps / arrays.
// No Prisma, no SQL, no network — tests run instantly.
// =============================================================================

class StubRouteRepository implements IRouteRepository {
  private store = new Map<string, Route>();

  seed(routes: Route[]): void {
    routes.forEach(r => this.store.set(r.routeId, r));
  }

  async findById(routeId: string): Promise<Route | null> {
    return this.store.get(routeId) ?? null;
  }

  async findAll(filters: RouteFilters = {}): Promise<Route[]> {
    return [...this.store.values()].filter(r =>
      (filters.year       === undefined || r.year       === filters.year)       &&
      (filters.vesselType === undefined || r.vesselType === filters.vesselType) &&
      (filters.fuelType   === undefined || r.fuelType   === filters.fuelType)
    );
  }

  async findBaseline(year: number): Promise<Route | null> {
    return [...this.store.values()].find(r => r.isBaseline && r.year === year) ?? null;
  }

  async save(route: Route): Promise<void> {
    this.store.set(route.routeId, route);
  }

  async clearBaselineForYear(year: number, exceptRouteId: string): Promise<void> {
    for (const [id, r] of this.store.entries()) {
      if (r.year === year && r.routeId !== exceptRouteId && r.isBaseline) {
        this.store.set(id, r.clearBaseline());
      }
    }
  }
}

class StubComplianceRepository implements IComplianceRepository {
  private store = new Map<string, CBSnapshot>(); // key: `${shipId}:${year}`

  async findByShipAndYear(shipId: string, year: number): Promise<CBSnapshot | null> {
    return this.store.get(`${shipId}:${year}`) ?? null;
  }

  async save(snapshot: CBSnapshot): Promise<void> {
    this.store.set(`${snapshot.shipId}:${snapshot.year}`, snapshot);
  }
}

class StubBankRepository implements IBankRepository {
  private store: BankEntry[] = [];

  seed(entries: BankEntry[]): void {
    this.store.push(...entries);
  }

  async findOpenByShipAndYear(shipId: string, year: number): Promise<BankEntry[]> {
    return this.store.filter(
      e => e.shipId === shipId && e.year === year && !e.isClosed()
    );
  }

  async totalAvailableBalance(shipId: string, year: number): Promise<number> {
    return this.store
      .filter(e => e.shipId === shipId && e.year === year && !e.isClosed())
      .reduce((sum, e) => sum + e.availableBalance, 0);
  }

  async save(entry: BankEntry): Promise<void> {
    const idx = this.store.findIndex(e => e.id === entry.id);
    if (idx >= 0) this.store[idx] = entry;
    else this.store.push(entry);
  }
}

class StubPoolRepository implements IPoolRepository {
  readonly saved: Pool[] = [];

  async save(pool: Pool): Promise<void> {
    this.saved.push(pool);
  }
}

class StubIdGenerator implements IIdGenerator {
  private count = 0;
  generate(): string { return `test-id-${++this.count}`; }
}

// =============================================================================
// SECTION 2 — Test helpers
// =============================================================================

const ROUTES = {
  R001: Route.create({ routeId:"R001", vesselType:"Container",   fuelType:"HFO", year:2024,
    ghgIntensity:91.0, fuelConsumption:5000, distance:12000, totalEmissions:4500 }, true),
  R002: Route.create({ routeId:"R002", vesselType:"BulkCarrier", fuelType:"LNG", year:2024,
    ghgIntensity:88.0, fuelConsumption:4800, distance:11500, totalEmissions:4200 }),
  R003: Route.create({ routeId:"R003", vesselType:"Tanker",      fuelType:"MGO", year:2024,
    ghgIntensity:93.5, fuelConsumption:5100, distance:12500, totalEmissions:4700 }),
  R004: Route.create({ routeId:"R004", vesselType:"RoRo",        fuelType:"HFO", year:2025,
    ghgIntensity:89.2, fuelConsumption:4900, distance:11800, totalEmissions:4300 }),
  R005: Route.create({ routeId:"R005", vesselType:"Container",   fuelType:"LNG", year:2025,
    ghgIntensity:90.5, fuelConsumption:4950, distance:11900, totalEmissions:4400 }),
};

interface TestContext {
  app:        Application;
  routeRepo:  StubRouteRepository;
  compRepo:   StubComplianceRepository;
  bankRepo:   StubBankRepository;
  poolRepo:   StubPoolRepository;
  ids:        StubIdGenerator;
}

function buildTestApp(seedRoutes = true): TestContext {
  const routeRepo = new StubRouteRepository();
  const compRepo  = new StubComplianceRepository();
  const bankRepo  = new StubBankRepository();
  const poolRepo  = new StubPoolRepository();
  const ids       = new StubIdGenerator();

  if (seedRoutes) {
    routeRepo.seed(Object.values(ROUTES));
  }

  const uc: IComplianceUseCases = {
    listRoutes:  (f) => new ListRoutes(routeRepo).execute(f),
    setBaseline: (i) => new SetBaseline(routeRepo).execute(i),
    getComparison: (i) => new GetComparison(routeRepo).execute(i),
    computeCB:   (i) => new ComputeComplianceBalance(routeRepo, compRepo).execute(i),
    getAdjustedCB: (i) => new GetAdjustedCB(compRepo).execute(i),
    listBankRecords: (i) => new ListBankRecords(bankRepo).execute(i),
    bankSurplus: (i) => new BankSurplus(routeRepo, compRepo, bankRepo, ids).execute(i),
    applyBanked: (i) => new ApplyBankedCompliance(routeRepo, compRepo, bankRepo).execute(i),
    createPool:  (i) => new CreatePool(routeRepo, compRepo, bankRepo, poolRepo, ids).execute(i),
  };

  return { app: createApp(uc), routeRepo, compRepo, bankRepo, poolRepo, ids };
}

// Shorthand for checking the data envelope
const data  = (res: request.Response) => res.body.data;
const error = (res: request.Response) => res.body.error;

// =============================================================================
// SECTION 3 — Routes endpoint tests
// =============================================================================

describe("GET /api/v1/routes", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = buildTestApp(); });

  it("returns all 5 seeded routes with 200", async () => {
    const res = await request(ctx.app).get("/api/v1/routes");
    expect(res.status).toBe(200);
    expect(data(res).routes).toHaveLength(5);
  });

  it("filters by year", async () => {
    const res = await request(ctx.app).get("/api/v1/routes?year=2024");
    expect(res.status).toBe(200);
    const routes = data(res).routes;
    expect(routes).toHaveLength(3);
    routes.forEach((r: any) => expect(r.year).toBe(2024));
  });

  it("filters by vesselType", async () => {
    const res = await request(ctx.app).get("/api/v1/routes?vesselType=Container");
    const routes = data(res).routes;
    routes.forEach((r: any) => expect(r.vesselType).toBe("Container"));
    expect(routes).toHaveLength(2);
  });

  it("filters by fuelType", async () => {
    const res = await request(ctx.app).get("/api/v1/routes?fuelType=LNG");
    const routes = data(res).routes;
    routes.forEach((r: any) => expect(r.fuelType).toBe("LNG"));
  });

  it("returns all assignment fields per route", async () => {
    const res   = await request(ctx.app).get("/api/v1/routes");
    const route = data(res).routes.find((r: any) => r.routeId === "R001");
    expect(route).toMatchObject({
      routeId:         "R001",
      vesselType:      "Container",
      fuelType:        "HFO",
      year:            2024,
      ghgIntensity:    91.0,
      fuelConsumption: 5000,
      distance:        12000,
      totalEmissions:  4500,
      isBaseline:      true,
    });
  });

  it("includes computed fields: isCompliant, energyInScopeMJ", async () => {
    const res   = await request(ctx.app).get("/api/v1/routes");
    const r001  = data(res).routes.find((r: any) => r.routeId === "R001");
    const r002  = data(res).routes.find((r: any) => r.routeId === "R002");

    expect(r001.isCompliant).toBe(false);            // 91.0 > target
    expect(r002.isCompliant).toBe(true);             // 88.0 < target
    expect(r001.energyInScopeMJ).toBe(5000 * 41000);
  });

  it("returns empty array when no routes match filters", async () => {
    const res = await request(ctx.app).get("/api/v1/routes?vesselType=Ferry");
    expect(data(res).routes).toHaveLength(0);
  });

  it("returns 400 when year filter is not a valid integer", async () => {
    const res = await request(ctx.app).get("/api/v1/routes?year=banana");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/routes/:id/baseline", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = buildTestApp(); });

  it("sets the target route as baseline and clears the previous one", async () => {
    const res = await request(ctx.app).post("/api/v1/routes/R002/baseline");
    expect(res.status).toBe(200);
    expect(data(res).route.routeId).toBe("R002");
    expect(data(res).route.isBaseline).toBe(true);

    // Verify R001 is no longer baseline
    const list = await request(ctx.app).get("/api/v1/routes");
    const r001 = data(list).routes.find((r: any) => r.routeId === "R001");
    expect(r001.isBaseline).toBe(false);
  });

  it("returns 404 when routeId does not exist", async () => {
    const res = await request(ctx.app).post("/api/v1/routes/R999/baseline");
    expect(res.status).toBe(404);
    expect(error(res).code).toBe("NOT_FOUND");
  });

  it("is idempotent: setting the existing baseline again succeeds", async () => {
    const res = await request(ctx.app).post("/api/v1/routes/R001/baseline");
    expect(res.status).toBe(200);
    expect(data(res).route.isBaseline).toBe(true);
  });
});

describe("GET /api/v1/routes/comparison", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = buildTestApp(); });

  it("returns comparisons for all non-baseline routes in the year", async () => {
    const res  = await request(ctx.app).get("/api/v1/routes/comparison?year=2024");
    expect(res.status).toBe(200);
    // R001 is baseline for 2024 → R002 and R003 are comparisons
    expect(data(res).comparisons).toHaveLength(2);
  });

  it("comparisons include percentDiff and compliant flag", async () => {
    const res  = await request(ctx.app).get("/api/v1/routes/comparison?year=2024");
    const r002 = data(res).comparisons.find((c: any) => c.comparisonRouteId === "R002");

    expect(r002).toBeDefined();
    // R002=88.0 < R001=91.0 → percentDiff < 0
    expect(r002.percentDiff).toBeLessThan(0);
    expect(r002.compliant).toBe(true);            // 88.0 ≤ 89.3368

    const r003 = data(res).comparisons.find((c: any) => c.comparisonRouteId === "R003");
    expect(r003.percentDiff).toBeGreaterThan(0);
    expect(r003.compliant).toBe(false);           // 93.5 > 89.3368
  });

  it("uses the formula ((comparison / baseline) - 1) × 100", async () => {
    const res   = await request(ctx.app).get("/api/v1/routes/comparison?year=2024");
    const r002  = data(res).comparisons.find((c: any) => c.comparisonRouteId === "R002");
    const expected = ((88.0 / 91.0) - 1) * 100;
    expect(r002.percentDiff).toBeCloseTo(expected, 4);
  });

  it("returns 422 when no baseline is set for the requested year", async () => {
    // Year 2026 has no routes/baseline
    const res = await request(ctx.app).get("/api/v1/routes/comparison?year=2026");
    expect(res.status).toBe(422);
    expect(error(res).code).toBe("DOMAIN_RULE");
  });

  it("returns 400 when year query param is missing", async () => {
    const res = await request(ctx.app).get("/api/v1/routes/comparison");
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// SECTION 4 — Banking endpoint tests
// =============================================================================

describe("GET /api/v1/compliance/cb", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = buildTestApp(); });

  it("computes and returns CB for a surplus route (R002)", async () => {
    const res = await request(ctx.app)
      .get("/api/v1/compliance/cb?shipId=SHIP-A&routeId=R002&year=2024");

    expect(res.status).toBe(200);
    const d = data(res);
    expect(d.shipId).toBe("SHIP-A");
    expect(d.routeId).toBe("R002");
    expect(d.cbGco2eq).toBeGreaterThan(0);
    expect(d.isSurplus).toBe(true);
    expect(d.energyInScopeMJ).toBe(4800 * 41000);
  });

  it("computes and returns CB for a deficit route (R001)", async () => {
    const res = await request(ctx.app)
      .get("/api/v1/compliance/cb?shipId=SHIP-B&routeId=R001&year=2024");

    expect(res.status).toBe(200);
    const d = data(res);
    expect(d.cbGco2eq).toBeLessThan(0);
    expect(d.isSurplus).toBe(false);
  });

  it("returns 404 when routeId does not exist", async () => {
    const res = await request(ctx.app)
      .get("/api/v1/compliance/cb?shipId=S&routeId=R999&year=2024");
    expect(res.status).toBe(404);
  });

  it("returns 400 when required params are missing", async () => {
    const res = await request(ctx.app).get("/api/v1/compliance/cb?shipId=S&year=2024");
    expect(res.status).toBe(400);
    expect(error(res).field).toBe("routeId");
  });

  it("returns 400 when year mismatches the route's year", async () => {
    // R001 is year 2024, querying with 2025 should fail
    const res = await request(ctx.app)
      .get("/api/v1/compliance/cb?shipId=S&routeId=R001&year=2025");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/banking/bank", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = buildTestApp(); });

  it("banks a surplus CB and returns 201 with entry details", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ shipId: "SHIP-A", routeId: "R002", year: 2024 });

    expect(res.status).toBe(201);
    const d = data(res);
    expect(d.shipId).toBe("SHIP-A");
    expect(d.bankedAmountGco2eq).toBeGreaterThan(0);
    expect(d.bankEntryId).toBeTruthy();
  });

  it("returns 422 when route is in deficit (cannot bank)", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ shipId: "SHIP-B", routeId: "R001", year: 2024 });

    expect(res.status).toBe(422);
    expect(error(res).code).toBe("DOMAIN_RULE");
  });

  it("returns 409 when ship already has an open bank entry for the year", async () => {
    // First bank succeeds
    await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ shipId: "SHIP-A", routeId: "R002", year: 2024 });

    // Second bank for same ship-year must conflict
    const res = await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ shipId: "SHIP-A", routeId: "R002", year: 2024 });

    expect(res.status).toBe(409);
    expect(error(res).code).toBe("CONFLICT");
  });

  it("returns 404 when route does not exist", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ shipId: "S", routeId: "RXXX", year: 2024 });
    expect(res.status).toBe(404);
  });

  it("returns 400 when required body fields are missing", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ routeId: "R002", year: 2024 });     // missing shipId
    expect(res.status).toBe(400);
    expect(error(res).field).toBe("shipId");
  });

  it("returns 400 when year is invalid", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ shipId: "S", routeId: "R002", year: 1990 });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/banking/apply", () => {
  let ctx: TestContext;
  const SHIP = "SHIP-DEF";

  // Before each: bank surplus from R002 under SHIP-SUR, then we'll apply against R001 deficit
  beforeEach(async () => {
    ctx = buildTestApp();
    // Bank some surplus for SHIP-SUR
    await request(ctx.app)
      .post("/api/v1/banking/bank")
      .send({ shipId: SHIP, routeId: "R002", year: 2024 });
  });

  it("applies banked credits and returns updated CB values", async () => {
    const bankRes = await request(ctx.app)
      .get(`/api/v1/banking/records?shipId=${SHIP}&year=2024`);
    const balance = data(bankRes).entries[0].availableBalance;

    const res = await request(ctx.app)
      .post("/api/v1/banking/apply")
      .send({ shipId: SHIP, routeId: "R001", year: 2024, amountToApply: balance * 0.5 });

    expect(res.status).toBe(200);
    const d = data(res);
    expect(d.applied).toBeGreaterThan(0);
    expect(d.cbAfter).toBeGreaterThan(d.cbBefore);
    expect(d.remainingBankBalance).toBeGreaterThan(0);
  });

  it("returns 422 when the ship is not in deficit", async () => {
    // R002 is surplus — applying banked credits makes no sense
    const res = await request(ctx.app)
      .post("/api/v1/banking/apply")
      .send({ shipId: SHIP, routeId: "R002", year: 2024, amountToApply: 1_000_000 });

    expect(res.status).toBe(422);
  });

  it("returns 422 when no banked balance is available", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/banking/apply")
      .send({ shipId: "NO-BALANCE-SHIP", routeId: "R001", year: 2024, amountToApply: 1_000_000 });

    expect(res.status).toBe(422);
  });

  it("returns 400 when amountToApply is zero or negative", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/banking/apply")
      .send({ shipId: SHIP, routeId: "R001", year: 2024, amountToApply: -100 });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// SECTION 5 — Pool endpoint tests
// =============================================================================

describe("POST /api/v1/pools", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = buildTestApp(); });

  const VALID_POOL = {
    year: 2024,
    members: [
      { shipId: "SHIP-A", routeId: "R002" },  // surplus (88.0)
      { shipId: "SHIP-B", routeId: "R003" },  // deficit (93.5)
    ],
  };

  it("creates a pool and returns allocation results with 201", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send(VALID_POOL);

    expect(res.status).toBe(201);
    const d = data(res);
    expect(d.poolId).toBeTruthy();
    expect(d.year).toBe(2024);
    expect(d.members).toHaveLength(2);
    expect(d.isBalanced).toBe(true);
  });

  it("returns cbBefore and cbAfter for every member", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send(VALID_POOL);
    const members = data(res).members;

    for (const m of members) {
      expect(typeof m.cbBefore).toBe("number");
      expect(typeof m.cbAfter).toBe("number");
      expect(typeof m.transfer).toBe("number");
    }
  });

  it("deficit member exits no worse than it entered (Article 21 rule 1)", async () => {
    const res     = await request(ctx.app).post("/api/v1/pools").send(VALID_POOL);
    const defMem  = data(res).members.find((m: any) => m.shipId === "SHIP-B");
    expect(defMem.cbAfter).toBeGreaterThanOrEqual(defMem.cbBefore - 1e-6);
  });

  it("surplus member does not exit negative (Article 21 rule 2)", async () => {
    const res     = await request(ctx.app).post("/api/v1/pools").send(VALID_POOL);
    const surMem  = data(res).members.find((m: any) => m.shipId === "SHIP-A");
    expect(surMem.cbAfter).toBeGreaterThanOrEqual(-1e-6);
  });

  it("returns 422 when ∑ adjustedCB < 0 (collective deficit)", async () => {
    // Both routes are deficits — pool sum < 0
    const res = await request(ctx.app).post("/api/v1/pools").send({
      year: 2024,
      members: [
        { shipId: "SHIP-X", routeId: "R001" },  // deficit 91.0
        { shipId: "SHIP-Y", routeId: "R003" },  // deficit 93.5
      ],
    });

    expect(res.status).toBe(422);
    expect(error(res).code).toBe("DOMAIN_RULE");
  });

  it("returns 400 when fewer than 2 members are provided", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send({
      year: 2024,
      members: [{ shipId: "SHIP-A", routeId: "R002" }],
    });

    expect(res.status).toBe(400);
    expect(error(res).field).toBe("members");
  });

  it("returns 400 when duplicate shipIds are in the member list", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send({
      year: 2024,
      members: [
        { shipId: "SHIP-DUP", routeId: "R002" },
        { shipId: "SHIP-DUP", routeId: "R003" },
      ],
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 when a member route does not exist", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send({
      year: 2024,
      members: [
        { shipId: "SHIP-A", routeId: "R002" },
        { shipId: "SHIP-B", routeId: "RXXX" },  // does not exist
      ],
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 when year is missing", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send({
      members: [{ shipId: "A", routeId: "R002" }, { shipId: "B", routeId: "R003" }],
    });
    expect(res.status).toBe(400);
    expect(error(res).field).toBe("year");
  });

  it("returns 400 when a member is missing routeId", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send({
      year: 2024,
      members: [
        { shipId: "A" },                         // missing routeId
        { shipId: "B", routeId: "R003" },
      ],
    });
    expect(res.status).toBe(400);
  });

  it("pool sum is non-negative in the response", async () => {
    const res = await request(ctx.app).post("/api/v1/pools").send(VALID_POOL);
    expect(data(res).poolSumGco2eq).toBeGreaterThanOrEqual(-1e-6);
  });

  it("handles a 3-member pool with mixed surplus/deficit correctly", async () => {
    // R002=surplus, R004=surplus(89.2 < target? no, 89.2 < 89.3368 yes), R003=deficit
    const res = await request(ctx.app).post("/api/v1/pools").send({
      year: 2025,
      members: [
        { shipId: "SHIP-A", routeId: "R004" },   // 89.2 < target → surplus
        { shipId: "SHIP-B", routeId: "R005" },   // 90.5 > target → deficit
        { shipId: "SHIP-C", routeId: "R004" },   // same route, different ship
      ],
    });

    // R004 surplus × 2 vs R005 deficit — sum must be checked
    // 2×(89.3368-89.2)×4900×41000 + (89.3368-90.5)×4950×41000
    const surCB = 2 * (FUEL_EU.TARGET_GHG_INTENSITY - 89.2) * 4900 * 41000;
    const defCB = (FUEL_EU.TARGET_GHG_INTENSITY - 90.5) * 4950 * 41000;
    const expectedSum = surCB + defCB;

    if (expectedSum >= 0) {
      expect(res.status).toBe(201);
      expect(data(res).isBalanced).toBe(true);
    } else {
      expect(res.status).toBe(422);
    }
  });
});

// =============================================================================
// SECTION 6 — Health check + 404 guard
// =============================================================================

describe("Infrastructure endpoints", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = buildTestApp(); });

  it("GET /health returns 200 with status ok", async () => {
    const res = await request(ctx.app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.ts).toBe("string");
  });

  it("unknown routes return 404 with NOT_FOUND error code", async () => {
    const res = await request(ctx.app).get("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    expect(error(res).code).toBe("NOT_FOUND");
  });
});
