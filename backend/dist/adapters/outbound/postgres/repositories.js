"use strict";
// =============================================================================
// FuelEU Maritime — Postgres Adapter Implementations
// Each class implements a port interface from application.ts using Prisma.
// ALL mapping between DB rows and domain entities uses the mapper objects
// from application.ts — never inline here.
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UuidIdGenerator = exports.PrismaPoolRepository = exports.PrismaBankRepository = exports.PrismaComplianceRepository = exports.PrismaRouteRepository = void 0;
const application_1 = require("../../core/application/application");
const crypto_1 = __importDefault(require("crypto"));
// ─── RouteRepository ─────────────────────────────────────────────────────────
class PrismaRouteRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(routeId) {
        const row = await this.db.route.findUnique({ where: { routeId } });
        return row ? application_1.RouteMapper.toDomain(row) : null;
    }
    async findAll(filters = {}) {
        const where = {};
        if (filters.year)
            where.year = filters.year;
        if (filters.vesselType)
            where.vesselType = filters.vesselType;
        if (filters.fuelType)
            where.fuelType = filters.fuelType;
        const rows = await this.db.route.findMany({ where });
        return rows.map(r => application_1.RouteMapper.toDomain(r));
    }
    async findBaseline(year) {
        const row = await this.db.route.findFirst({ where: { year, isBaseline: true } });
        return row ? application_1.RouteMapper.toDomain(row) : null;
    }
    async save(route) {
        const data = application_1.RouteMapper.toRow(route);
        await this.db.route.upsert({
            where: { routeId: route.routeId },
            update: data,
            create: { id: crypto_1.default.randomUUID(), ...data },
        });
    }
    async clearBaselineForYear(year, exceptRouteId) {
        await this.db.route.updateMany({
            where: { year, isBaseline: true, routeId: { not: exceptRouteId } },
            data: { isBaseline: false },
        });
    }
}
exports.PrismaRouteRepository = PrismaRouteRepository;
// ─── ComplianceRepository ─────────────────────────────────────────────────────
class PrismaComplianceRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findByShipAndYear(shipId, year) {
        const row = await this.db.shipCompliance.findUnique({
            where: { shipId_year: { shipId, year } },
        });
        return row ? application_1.ComplianceMapper.toSnapshot(row) : null;
    }
    async save(snapshot) {
        const data = application_1.ComplianceMapper.toRow(snapshot);
        await this.db.shipCompliance.upsert({
            where: { shipId_year: { shipId: snapshot.shipId, year: snapshot.year } },
            update: { cbGco2eq: data.cb_gco2eq },
            create: {
                id: crypto_1.default.randomUUID(),
                shipId: data.ship_id,
                year: data.year,
                routeId: data.route_id,
                cbGco2eq: data.cb_gco2eq,
            },
        });
    }
}
exports.PrismaComplianceRepository = PrismaComplianceRepository;
// ─── BankRepository ───────────────────────────────────────────────────────────
class PrismaBankRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findOpenByShipAndYear(shipId, year) {
        const rows = await this.db.bankEntry.findMany({
            where: { shipId, year, status: { not: "fully_applied" } },
            orderBy: { createdAt: "asc" }, // FIFO
        });
        return rows.map(r => application_1.BankEntryMapper.toDomain(r));
    }
    async totalAvailableBalance(shipId, year) {
        const result = await this.db.bankEntry.aggregate({
            where: { shipId, year, status: { not: "fully_applied" } },
            _sum: { amountGco2eq: true, appliedGco2eq: true },
        });
        const amount = Number(result._sum.amountGco2eq ?? 0);
        const applied = Number(result._sum.appliedGco2eq ?? 0);
        return amount - applied;
    }
    async save(entry) {
        const exists = await this.db.bankEntry.findUnique({ where: { id: entry.id } });
        if (exists) {
            const upd = application_1.BankEntryMapper.toUpdateRow(entry);
            await this.db.bankEntry.update({
                where: { id: entry.id },
                data: { appliedGco2eq: upd.applied_gco2eq, status: upd.status },
            });
        }
        else {
            const ins = application_1.BankEntryMapper.toInsertRow(entry);
            await this.db.bankEntry.create({
                data: { id: entry.id, shipId: ins.ship_id, year: ins.year, amountGco2eq: ins.amount_gco2eq, appliedGco2eq: 0, status: "banked" },
            });
        }
    }
}
exports.PrismaBankRepository = PrismaBankRepository;
// ─── PoolRepository ───────────────────────────────────────────────────────────
class PrismaPoolRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async save(pool) {
        const poolRow = application_1.PoolMapper.toPoolRow(pool);
        const memberRows = application_1.PoolMapper.toMemberRows(pool);
        await this.db.$transaction(async (tx) => {
            await tx.pool.create({
                data: { id: pool.id, year: poolRow.year, poolSum: poolRow.pool_sum },
            });
            for (const m of memberRows) {
                await tx.poolMember.create({
                    data: {
                        id: crypto_1.default.randomUUID(),
                        poolId: m.pool_id,
                        shipId: m.ship_id,
                        cbBefore: m.cb_before,
                        cbAfter: m.cb_after,
                        transfer: m.transfer,
                    },
                });
            }
        });
    }
}
exports.PrismaPoolRepository = PrismaPoolRepository;
// ─── UuidIdGenerator ─────────────────────────────────────────────────────────
class UuidIdGenerator {
    generate() {
        return crypto_1.default.randomUUID();
    }
}
exports.UuidIdGenerator = UuidIdGenerator;
//# sourceMappingURL=repositories.js.map