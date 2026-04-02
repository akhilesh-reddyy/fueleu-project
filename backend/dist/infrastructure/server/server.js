"use strict";
// =============================================================================
// FuelEU Maritime — Composition Root
// This is the ONLY file that imports concrete implementations.
// Everything else depends on port interfaces.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const http_1 = require("../../adapters/inbound/http/http");
const RouteRepository_1 = require("../../adapters/outbound/postgres/RouteRepository");
const ComplianceRepository_1 = require("../../adapters/outbound/postgres/ComplianceRepository");
const BankRepository_1 = require("../../adapters/outbound/postgres/BankRepository");
const PoolRepository_1 = require("../../adapters/outbound/postgres/PoolRepository");
const UuidIdGenerator_1 = require("../../adapters/outbound/postgres/UuidIdGenerator");
const prismaClient_1 = require("../db/prismaClient");
const application_1 = require("../../core/application/application");
// ─── Instantiate outbound adapters ───────────────────────────────────────────
const routeRepo = new RouteRepository_1.PrismaRouteRepository(prismaClient_1.prisma);
const complianceRepo = new ComplianceRepository_1.PrismaComplianceRepository(prismaClient_1.prisma);
const bankRepo = new BankRepository_1.PrismaBankRepository(prismaClient_1.prisma);
const poolRepo = new PoolRepository_1.PrismaPoolRepository(prismaClient_1.prisma);
const ids = new UuidIdGenerator_1.UuidIdGenerator();
// ─── Wire use-cases (inject concrete adapters into use-case constructors) ────
const useCases = {
    listRoutes: (f) => new application_1.ListRoutes(routeRepo).execute(f),
    setBaseline: (i) => new application_1.SetBaseline(routeRepo).execute(i),
    getComparison: (i) => new application_1.GetComparison(routeRepo).execute(i),
    computeCB: (i) => new application_1.ComputeComplianceBalance(routeRepo, complianceRepo).execute(i),
    getAdjustedCB: (i) => new application_1.GetAdjustedCB(complianceRepo).execute(i),
    listBankRecords: (i) => new application_1.ListBankRecords(bankRepo).execute(i),
    bankSurplus: (i) => new application_1.BankSurplus(routeRepo, complianceRepo, bankRepo, ids).execute(i),
    applyBanked: (i) => new application_1.ApplyBankedCompliance(routeRepo, complianceRepo, bankRepo).execute(i),
    createPool: (i) => new application_1.CreatePool(routeRepo, complianceRepo, bankRepo, poolRepo, ids).execute(i),
};
// ─── Build Express app and start listening ────────────────────────────────────
const PORT = Number(process.env.PORT ?? 4000);
const app = (0, http_1.createApp)(useCases);
exports.app = app;
app.listen(PORT, () => {
    console.log(`[FuelEU] Server running on http://localhost:${PORT}`);
    console.log(`[FuelEU] Health → http://localhost:${PORT}/health`);
    console.log(`[FuelEU] API    → http://localhost:${PORT}/api/v1`);
});
//# sourceMappingURL=server.js.map