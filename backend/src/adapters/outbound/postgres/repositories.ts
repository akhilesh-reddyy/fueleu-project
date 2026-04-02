// =============================================================================
// FuelEU Maritime — Postgres Adapter Implementations
// Each class implements a port interface from application.ts using Prisma.
// ALL mapping between DB rows and domain entities uses the mapper objects
// from application.ts — never inline here.
// =============================================================================

import type { PrismaClient }           from "@prisma/client";
import { Route, BankEntry, Pool }      from "../../core/domain/domain";
import {
  RouteMapper, ComplianceMapper, BankEntryMapper, PoolMapper,
  type IRouteRepository,
  type IComplianceRepository,
  type IBankRepository,
  type IPoolRepository,
  type IIdGenerator,
  type RouteFilters,
  type CBSnapshot,
} from "../../core/application/application";
import crypto from "crypto";

// ─── RouteRepository ─────────────────────────────────────────────────────────

export class PrismaRouteRepository implements IRouteRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(routeId: string): Promise<Route | null> {
    const row = await this.db.route.findUnique({ where: { routeId } });
    return row ? RouteMapper.toDomain(row as any) : null;
  }

  async findAll(filters: RouteFilters = {}): Promise<Route[]> {
    const where: Record<string, unknown> = {};
    if (filters.year)       where.year       = filters.year;
    if (filters.vesselType) where.vesselType  = filters.vesselType;
    if (filters.fuelType)   where.fuelType    = filters.fuelType;
    const rows = await this.db.route.findMany({ where });
    return rows.map(r => RouteMapper.toDomain(r as any));
  }

  async findBaseline(year: number): Promise<Route | null> {
    const row = await this.db.route.findFirst({ where: { year, isBaseline: true } });
    return row ? RouteMapper.toDomain(row as any) : null;
  }

  async save(route: Route): Promise<void> {
    const data = RouteMapper.toRow(route);
    await this.db.route.upsert({
      where:  { routeId: route.routeId },
      update: data as any,
      create: { id: crypto.randomUUID(), ...data } as any,
    });
  }

  async clearBaselineForYear(year: number, exceptRouteId: string): Promise<void> {
    await this.db.route.updateMany({
      where:  { year, isBaseline: true, routeId: { not: exceptRouteId } },
      data:   { isBaseline: false },
    });
  }
}

// ─── ComplianceRepository ─────────────────────────────────────────────────────

export class PrismaComplianceRepository implements IComplianceRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByShipAndYear(shipId: string, year: number): Promise<CBSnapshot | null> {
    const row = await this.db.shipCompliance.findUnique({
      where: { shipId_year: { shipId, year } },
    });
    return row ? ComplianceMapper.toSnapshot(row as any) : null;
  }

  async save(snapshot: CBSnapshot): Promise<void> {
    const data = ComplianceMapper.toRow(snapshot);
    await this.db.shipCompliance.upsert({
      where:  { shipId_year: { shipId: snapshot.shipId, year: snapshot.year } },
      update: { cbGco2eq: data.cb_gco2eq as any },
      create: {
        id:       crypto.randomUUID(),
        shipId:   data.ship_id,
        year:     data.year,
        routeId:  data.route_id,
        cbGco2eq: data.cb_gco2eq as any,
      } as any,
    });
  }
}

// ─── BankRepository ───────────────────────────────────────────────────────────

export class PrismaBankRepository implements IBankRepository {
  constructor(private readonly db: PrismaClient) {}

  async findOpenByShipAndYear(shipId: string, year: number): Promise<BankEntry[]> {
    const rows = await this.db.bankEntry.findMany({
      where: { shipId, year, status: { not: "fully_applied" } },
      orderBy: { createdAt: "asc" },   // FIFO
    });
    return rows.map(r => BankEntryMapper.toDomain(r as any));
  }

  async totalAvailableBalance(shipId: string, year: number): Promise<number> {
    const result = await this.db.bankEntry.aggregate({
      where: { shipId, year, status: { not: "fully_applied" } },
      _sum:  { amountGco2eq: true, appliedGco2eq: true },
    });
    const amount  = Number(result._sum.amountGco2eq  ?? 0);
    const applied = Number(result._sum.appliedGco2eq ?? 0);
    return amount - applied;
  }

  async save(entry: BankEntry): Promise<void> {
    const exists = await this.db.bankEntry.findUnique({ where: { id: entry.id } });
    if (exists) {
      const upd = BankEntryMapper.toUpdateRow(entry);
      await this.db.bankEntry.update({
        where: { id: entry.id },
        data:  { appliedGco2eq: upd.applied_gco2eq as any, status: upd.status },
      });
    } else {
      const ins = BankEntryMapper.toInsertRow(entry);
      await this.db.bankEntry.create({
        data: { id: entry.id, shipId: ins.ship_id, year: ins.year, amountGco2eq: ins.amount_gco2eq as any, appliedGco2eq: 0, status: "banked" } as any,
      });
    }
  }
}

// ─── PoolRepository ───────────────────────────────────────────────────────────

export class PrismaPoolRepository implements IPoolRepository {
  constructor(private readonly db: PrismaClient) {}

  async save(pool: Pool): Promise<void> {
    const poolRow    = PoolMapper.toPoolRow(pool);
    const memberRows = PoolMapper.toMemberRows(pool);

    await this.db.$transaction(async (tx) => {
      await tx.pool.create({
        data: { id: pool.id, year: poolRow.year, poolSum: poolRow.pool_sum as any },
      });
      for (const m of memberRows) {
        await tx.poolMember.create({
          data: {
            id:       crypto.randomUUID(),
            poolId:   m.pool_id,
            shipId:   m.ship_id,
            cbBefore: m.cb_before as any,
            cbAfter:  m.cb_after  as any,
            transfer: m.transfer  as any,
          } as any,
        });
      }
    });
  }
}

// ─── UuidIdGenerator ─────────────────────────────────────────────────────────

export class UuidIdGenerator implements IIdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
