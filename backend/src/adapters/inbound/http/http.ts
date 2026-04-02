// =============================================================================
// FuelEU Maritime — HTTP Adapter Layer
// Express controllers + router + error handler + server bootstrap
// Zero business logic — all orchestration delegated to use-case layer
// =============================================================================

import express, {
  Request, Response, NextFunction,
  Router, RequestHandler
} from "express";

import type {
  IComplianceUseCases,
  ApplicationError,
  Result,
} from "../../../core/application/application";

// =============================================================================
// HTTP helpers
// =============================================================================

function statusFor(err: ApplicationError): number {
  switch (err.code) {
    case "NOT_FOUND":   return 404;
    case "VALIDATION":  return 400;
    case "CONFLICT":    return 409;
    case "DOMAIN_RULE": return 422;
    default:            return 500;
  }
}

function handle<T>(
  fn: (req: Request, res: Response) => Promise<Result<T>>,
  successStatus = 200
): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await fn(req, res);
      if (result.ok) {
        res.status(successStatus).json({ data: result.value });
      } else {
        res.status(statusFor(result.error)).json({ error: result.error });
      }
    } catch (err) {
      next(err);
    }
  };
}

// =============================================================================
// Input sanitisers
// =============================================================================

function requireString(value: unknown, field: string, maxLen = 200): string {
  if (typeof value !== "string" || !value.trim()) {
    throw { code: "VALIDATION", message: `${field} is required`, field } as ApplicationError;
  }
  if (value.length > maxLen) {
    throw { code: "VALIDATION", message: `${field} must be ≤ ${maxLen} chars`, field } as ApplicationError;
  }
  return value.trim();
}

function requireYear(value: unknown, field = "year"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2024 || n > 2050) {
    throw { code: "VALIDATION", message: `${field} must be 2024–2050`, field } as ApplicationError;
  }
  return n;
}

function requirePositiveNumber(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw { code: "VALIDATION", message: `${field} must be a positive number`, field } as ApplicationError;
  }
  return n;
}

function requireArray<T>(value: unknown, field: string, minLen = 1): T[] {
  if (!Array.isArray(value) || value.length < minLen) {
    throw { code: "VALIDATION", message: `${field} must be an array with ≥ ${minLen} item(s)`, field } as ApplicationError;
  }
  return value as T[];
}

function validate<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    const err = e as ApplicationError;
    if (err.code) return { ok: false, error: err };
    throw e;
  }
}

// =============================================================================
// Controllers
// =============================================================================

function buildRouteControllers(uc: IComplianceUseCases) {
  const listRoutes: RequestHandler = async (req, res, next) => {
    try {
      const year = req.query.year !== undefined ? requireYear(req.query.year) : undefined;
      const result = await uc.listRoutes({
        year,
        vesselType: req.query.vesselType as string | undefined,
        fuelType:   req.query.fuelType   as string | undefined,
      });
      result.ok
        ? res.status(200).json({ data: result.value })
        : res.status(statusFor(result.error)).json({ error: result.error });
    } catch (e) { next(e); }
  };

  const setBaseline: RequestHandler = handle(async (req) => {
    const v = validate(() => requireString(req.params.id, "id"));
    if (!v.ok) return v;
    return uc.setBaseline({ routeId: v.value });
  });

  const getComparison: RequestHandler = handle(async (req) => {
    const v = validate(() => ({ year: requireYear(req.query.year, "year") }));
    if (!v.ok) return v;
    return uc.getComparison(v.value);
  });

  return { listRoutes, setBaseline, getComparison };
}

function buildComplianceControllers(uc: IComplianceUseCases) {
  const getComplianceBalance: RequestHandler = handle(async (req) => {
    const v = validate(() => ({
      shipId:  requireString(req.query.shipId,  "shipId"),
      routeId: requireString(req.query.routeId, "routeId"),
      year:    requireYear(req.query.year,  "year"),
    }));
    if (!v.ok) return v;
    return uc.computeCB(v.value);
  });

  const getAdjustedCB: RequestHandler = handle(async (req) => {
    const v = validate(() => ({
      shipId: requireString(req.query.shipId, "shipId"),
      year:   requireYear(req.query.year,   "year"),
    }));
    if (!v.ok) return v;
    return uc.getAdjustedCB(v.value);
  });

  return { getComplianceBalance, getAdjustedCB };
}

function buildBankingControllers(uc: IComplianceUseCases) {
  const listBankRecords: RequestHandler = handle(async (req) => {
    const v = validate(() => ({
      shipId: requireString(req.query.shipId, "shipId"),
      year:   requireYear(req.query.year,   "year"),
    }));
    if (!v.ok) return v;
    return uc.listBankRecords(v.value);
  });

  const bankSurplus: RequestHandler = handle(async (req) => {
    const v = validate(() => ({
      shipId:  requireString(req.body?.shipId,  "shipId"),
      routeId: requireString(req.body?.routeId, "routeId"),
      year:    requireYear(req.body?.year,       "year"),
    }));
    if (!v.ok) return v;
    return uc.bankSurplus(v.value);
  }, 201);

  const applyBanked: RequestHandler = handle(async (req) => {
    const v = validate(() => ({
      shipId:        requireString(req.body?.shipId,  "shipId"),
      routeId:       requireString(req.body?.routeId, "routeId"),
      year:          requireYear(req.body?.year,       "year"),
      amountToApply: requirePositiveNumber(req.body?.amountToApply, "amountToApply"),
    }));
    if (!v.ok) return v;
    return uc.applyBanked(v.value);
  });

  return { listBankRecords, bankSurplus, applyBanked };
}

function buildPoolControllers(uc: IComplianceUseCases) {
  const createPool: RequestHandler = handle(async (req) => {
    const v = validate(() => {
      const year       = requireYear(req.body?.year, "year");
      const rawMembers = requireArray(req.body?.members, "members", 2);
      const members    = rawMembers.map((m: any, i: number) => ({
        shipId:  requireString(m?.shipId,  `members[${i}].shipId`),
        routeId: requireString(m?.routeId, `members[${i}].routeId`),
      }));
      return { year, members };
    });
    if (!v.ok) return v;
    return uc.createPool(v.value);
  }, 201);

  return { createPool };
}

// =============================================================================
// Router assembly
// =============================================================================

export function buildRouter(uc: IComplianceUseCases): Router {
  const router = Router();
  const routes     = buildRouteControllers(uc);
  const compliance = buildComplianceControllers(uc);
  const banking    = buildBankingControllers(uc);
  const pools      = buildPoolControllers(uc);

  // IMPORTANT: /routes/comparison must be registered before /routes/:id/baseline
  router.get ("/routes",                 routes.listRoutes);
  router.get ("/routes/comparison",      routes.getComparison);
  router.post("/routes/:id/baseline",    routes.setBaseline);

  router.get ("/compliance/cb",          compliance.getComplianceBalance);
  router.get ("/compliance/adjusted-cb", compliance.getAdjustedCB);

  router.get ("/banking/records",        banking.listBankRecords);
  router.post("/banking/bank",           banking.bankSurplus);
  router.post("/banking/apply",          banking.applyBanked);

  router.post("/pools",                  pools.createPool);

  return router;
}

// =============================================================================
// Error middleware
// =============================================================================

export function errorMiddleware(
  err: unknown, _req: Request, res: Response, _next: NextFunction
): void {
  console.error("[unhandled error]", err);
  const shaped = err as ApplicationError;
  if (shaped?.code) {
    res.status(statusFor(shaped)).json({ error: shaped });
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL", message: "An unexpected error occurred" } });
}

// =============================================================================
// App factory (imported by server.ts and by tests)
// =============================================================================

export function createApp(uc: IComplianceUseCases): express.Application {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use((req, _res, next) => {
    req.headers["x-request-id"] ??= crypto.randomUUID();
    next();
  });
  app.use("/api/v1", buildRouter(uc));
  app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
  app.use((_req, res) => res.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found", entity: "endpoint", id: "" },
  }));
  app.use(errorMiddleware);
  return app;
}
