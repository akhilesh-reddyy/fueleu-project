// =============================================================================
// FuelEU Maritime — Composition Root
// This is the ONLY file that imports concrete implementations.
// Everything else depends on port interfaces.
// =============================================================================

import "dotenv/config";
import { createApp }                   from "../../adapters/inbound/http/http";
import { PrismaRouteRepository }       from "../../adapters/outbound/postgres/RouteRepository";
import { PrismaComplianceRepository }  from "../../adapters/outbound/postgres/ComplianceRepository";
import { PrismaBankRepository }        from "../../adapters/outbound/postgres/BankRepository";
import { PrismaPoolRepository }        from "../../adapters/outbound/postgres/PoolRepository";
import { UuidIdGenerator }             from "../../adapters/outbound/postgres/UuidIdGenerator";
import { prisma }                      from "../db/prismaClient";
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
  type IComplianceUseCases,
} from "../../core/application/application";

// ─── Instantiate outbound adapters ───────────────────────────────────────────

const routeRepo      = new PrismaRouteRepository(prisma);
const complianceRepo = new PrismaComplianceRepository(prisma);
const bankRepo       = new PrismaBankRepository(prisma);
const poolRepo       = new PrismaPoolRepository(prisma);
const ids            = new UuidIdGenerator();

// ─── Wire use-cases (inject concrete adapters into use-case constructors) ────

const useCases: IComplianceUseCases = {
  listRoutes:  (f) => new ListRoutes(routeRepo).execute(f),
  setBaseline: (i) => new SetBaseline(routeRepo).execute(i),
  getComparison: (i) => new GetComparison(routeRepo).execute(i),
  computeCB:   (i) => new ComputeComplianceBalance(routeRepo, complianceRepo).execute(i),
  getAdjustedCB: (i) => new GetAdjustedCB(complianceRepo).execute(i),
  listBankRecords: (i) => new ListBankRecords(bankRepo).execute(i),
  bankSurplus: (i) => new BankSurplus(routeRepo, complianceRepo, bankRepo, ids).execute(i),
  applyBanked: (i) => new ApplyBankedCompliance(routeRepo, complianceRepo, bankRepo).execute(i),
  createPool:  (i) => new CreatePool(routeRepo, complianceRepo, bankRepo, poolRepo, ids).execute(i),
};

// ─── Build Express app and start listening ────────────────────────────────────

const PORT = Number(process.env.PORT ?? 4000);
const app  = createApp(useCases);

app.listen(PORT, () => {
  console.log(`[FuelEU] Server running on http://localhost:${PORT}`);
  console.log(`[FuelEU] Health → http://localhost:${PORT}/health`);
  console.log(`[FuelEU] API    → http://localhost:${PORT}/api/v1`);
});

export { app };   // Re-export for Supertest (tests import this, not server.ts)
