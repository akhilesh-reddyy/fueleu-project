import type { PrismaClient } from "@prisma/client";
import { Route, BankEntry, Pool } from "../../core/domain/domain";
import { type IRouteRepository, type IComplianceRepository, type IBankRepository, type IPoolRepository, type IIdGenerator, type RouteFilters, type CBSnapshot } from "../../core/application/application";
export declare class PrismaRouteRepository implements IRouteRepository {
    private readonly db;
    constructor(db: PrismaClient);
    findById(routeId: string): Promise<Route | null>;
    findAll(filters?: RouteFilters): Promise<Route[]>;
    findBaseline(year: number): Promise<Route | null>;
    save(route: Route): Promise<void>;
    clearBaselineForYear(year: number, exceptRouteId: string): Promise<void>;
}
export declare class PrismaComplianceRepository implements IComplianceRepository {
    private readonly db;
    constructor(db: PrismaClient);
    findByShipAndYear(shipId: string, year: number): Promise<CBSnapshot | null>;
    save(snapshot: CBSnapshot): Promise<void>;
}
export declare class PrismaBankRepository implements IBankRepository {
    private readonly db;
    constructor(db: PrismaClient);
    findOpenByShipAndYear(shipId: string, year: number): Promise<BankEntry[]>;
    totalAvailableBalance(shipId: string, year: number): Promise<number>;
    save(entry: BankEntry): Promise<void>;
}
export declare class PrismaPoolRepository implements IPoolRepository {
    private readonly db;
    constructor(db: PrismaClient);
    save(pool: Pool): Promise<void>;
}
export declare class UuidIdGenerator implements IIdGenerator {
    generate(): string;
}
//# sourceMappingURL=repositories.d.ts.map