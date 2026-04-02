import { Route, BankEntry, Pool, type BankStatus, type CBSnapshot, type RouteComparison } from "./domain";
export type Result<T, E = ApplicationError> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export declare const ok: <T>(value: T) => Result<T>;
export declare const err: <T>(error: ApplicationError) => Result<T>;
export type ApplicationError = {
    code: "NOT_FOUND";
    message: string;
    entity: string;
    id: string;
} | {
    code: "DOMAIN_RULE";
    message: string;
} | {
    code: "VALIDATION";
    message: string;
    field: string;
} | {
    code: "CONFLICT";
    message: string;
};
export declare const notFound: (entity: string, id: string) => ApplicationError;
export declare const domainRule: (message: string) => ApplicationError;
export declare const validation: (field: string, message: string) => ApplicationError;
export declare const conflict: (message: string) => ApplicationError;
export interface RouteRow {
    id: string;
    route_id: string;
    vessel_type: string;
    fuel_type: string;
    year: number;
    ghg_intensity: string | number;
    fuel_consumption: string | number;
    distance: string | number;
    total_emissions: string | number;
    is_baseline: boolean;
}
export interface ComplianceRow {
    id: string;
    ship_id: string;
    year: number;
    route_id: string;
    cb_gco2eq: string | number;
    is_surplus: boolean;
    computed_at: Date;
}
export interface BankEntryRow {
    id: string;
    ship_id: string;
    year: number;
    amount_gco2eq: string | number;
    applied_gco2eq: string | number;
    status: string;
    created_at: Date;
    updated_at: Date;
}
export interface PoolRow {
    id: string;
    year: number;
    pool_sum: string | number;
    created_at: Date;
}
export interface PoolMemberRow {
    id: string;
    pool_id: string;
    ship_id: string;
    cb_before: string | number;
    cb_after: string | number;
    transfer: string | number;
}
export interface RouteFilters {
    year?: number;
    vesselType?: string;
    fuelType?: string;
}
export interface IRouteRepository {
    findById(routeId: string): Promise<Route | null>;
    findAll(filters?: RouteFilters): Promise<Route[]>;
    findBaseline(year: number): Promise<Route | null>;
    save(route: Route): Promise<void>;
    clearBaselineForYear(year: number, exceptRouteId: string): Promise<void>;
}
export interface IComplianceRepository {
    findByShipAndYear(shipId: string, year: number): Promise<CBSnapshot | null>;
    save(snapshot: CBSnapshot): Promise<void>;
}
export interface IBankRepository {
    findOpenByShipAndYear(shipId: string, year: number): Promise<BankEntry[]>;
    totalAvailableBalance(shipId: string, year: number): Promise<number>;
    save(entry: BankEntry): Promise<void>;
}
export interface IPoolRepository {
    save(pool: Pool): Promise<void>;
}
export interface IIdGenerator {
    generate(): string;
}
export declare const RouteMapper: {
    /**
     * DB row → Route domain entity
     * Maps snake_case column names to the camelCase RouteProps the domain expects.
     */
    toDomain(row: RouteRow): Route;
    /**
     * Route domain entity → DB insert shape (snake_case)
     * Used by IRouteRepository.save() implementations.
     */
    toRow(route: Route): Omit<RouteRow, "id">;
};
export declare const ComplianceMapper: {
    /**
     * DB row → CBSnapshot (plain object used by use-cases and repositories).
     * ComplianceBalance is rehydrated from a Route — not from a snapshot row —
     * because the formula must always be re-derivable from first principles.
     */
    toSnapshot(row: ComplianceRow): CBSnapshot;
    /**
     * CBSnapshot → DB insert shape.
     * is_surplus is a GENERATED ALWAYS column — omitted from insert.
     */
    toRow(snapshot: CBSnapshot): Omit<ComplianceRow, "id" | "is_surplus" | "computed_at">;
};
export declare const BankEntryMapper: {
    /**
     * DB row → BankEntry domain entity.
     * BankEntry has a private constructor — we use the internal rehydration
     * path via Object.assign to restore applied state without re-running
     * the bank() factory (which would reject non-zero applied amounts).
     */
    toDomain(row: BankEntryRow): BankEntry;
    /**
     * BankEntry domain entity → DB update shape (status + applied_gco2eq).
     * amount_gco2eq and ship_id never change after creation.
     */
    toUpdateRow(entry: BankEntry): Pick<BankEntryRow, "applied_gco2eq" | "status">;
    /**
     * BankEntry → full DB insert shape (used on first save).
     */
    toInsertRow(entry: BankEntry): Omit<BankEntryRow, "id" | "created_at" | "updated_at">;
};
export declare const PoolMapper: {
    /**
     * Pool domain entity → DB insert shape for the pools header row.
     */
    toPoolRow(pool: Pool): Omit<PoolRow, "id" | "created_at">;
    /**
     * Pool domain entity → array of DB insert shapes for pool_members.
     */
    toMemberRows(pool: Pool): Array<Omit<PoolMemberRow, "id">>;
};
export interface IComplianceUseCases {
    listRoutes(filters: RouteFilters): Promise<Result<RouteListOutput>>;
    setBaseline(input: SetBaselineInput): Promise<Result<SetBaselineOutput>>;
    getComparison(input: GetComparisonInput): Promise<Result<RouteComparisonOutput>>;
    computeCB(input: ComputeCBInput): Promise<Result<ComputeCBOutput>>;
    getAdjustedCB(input: GetAdjustedCBInput): Promise<Result<AdjustedCBOutput>>;
    listBankRecords(input: ListBankInput): Promise<Result<BankRecordsOutput>>;
    bankSurplus(input: BankSurplusInput): Promise<Result<BankSurplusOutput>>;
    applyBanked(input: ApplyBankedInput): Promise<Result<ApplyBankedOutput>>;
    createPool(input: CreatePoolInput): Promise<Result<CreatePoolOutput>>;
}
export interface RouteListOutput {
    routes: RouteDTO[];
}
export interface RouteDTO {
    routeId: string;
    vesselType: string;
    fuelType: string;
    year: number;
    ghgIntensity: number;
    fuelConsumption: number;
    distance: number;
    totalEmissions: number;
    isBaseline: boolean;
    isCompliant: boolean;
    energyInScopeMJ: number;
}
export interface SetBaselineInput {
    routeId: string;
}
export interface SetBaselineOutput {
    route: RouteDTO;
}
export interface GetComparisonInput {
    year: number;
}
export interface RouteComparisonOutput {
    comparisons: RouteComparison[];
}
export interface ComputeCBInput {
    shipId: string;
    routeId: string;
    year: number;
}
export interface ComputeCBOutput {
    shipId: string;
    year: number;
    routeId: string;
    cbGco2eq: number;
    isSurplus: boolean;
    energyInScopeMJ: number;
    ghgIntensityActual: number;
    ghgIntensityTarget: number;
}
export interface GetAdjustedCBInput {
    shipId: string;
    year: number;
}
export interface AdjustedCBOutput {
    shipId: string;
    year: number;
    cbGco2eq: number;
    isSurplus: boolean;
}
export interface ListBankInput {
    shipId: string;
    year: number;
}
export interface BankRecordsOutput {
    entries: BankEntryDTO[];
}
export interface BankEntryDTO {
    id: string;
    shipId: string;
    year: number;
    amountGco2eq: number;
    appliedGco2eq: number;
    availableBalance: number;
    status: BankStatus;
}
export interface BankSurplusInput {
    shipId: string;
    routeId: string;
    year: number;
}
export interface BankSurplusOutput {
    bankEntryId: string;
    shipId: string;
    year: number;
    bankedAmountGco2eq: number;
}
export interface ApplyBankedInput {
    shipId: string;
    routeId: string;
    year: number;
    amountToApply: number;
}
export interface ApplyBankedOutput {
    shipId: string;
    year: number;
    cbBefore: number;
    applied: number;
    cbAfter: number;
    remainingBankBalance: number;
}
export interface CreatePoolInput {
    year: number;
    members: PoolMemberInputDTO[];
}
export interface PoolMemberInputDTO {
    shipId: string;
    routeId: string;
}
export interface CreatePoolOutput {
    poolId: string;
    year: number;
    poolSumGco2eq: number;
    isBalanced: boolean;
    members: PoolMemberOutputDTO[];
}
export interface PoolMemberOutputDTO {
    shipId: string;
    routeId: string;
    cbBefore: number;
    cbAfter: number;
    transfer: number;
}
export declare class ListRoutes {
    private readonly routes;
    constructor(routes: IRouteRepository);
    execute(filters: RouteFilters): Promise<Result<RouteListOutput>>;
}
export declare class SetBaseline {
    private readonly routes;
    constructor(routes: IRouteRepository);
    execute(input: SetBaselineInput): Promise<Result<SetBaselineOutput>>;
}
export declare class GetComparison {
    private readonly routes;
    constructor(routes: IRouteRepository);
    execute(input: GetComparisonInput): Promise<Result<RouteComparisonOutput>>;
}
export declare class ComputeComplianceBalance {
    private readonly routes;
    private readonly compliance;
    constructor(routes: IRouteRepository, compliance: IComplianceRepository);
    execute(input: ComputeCBInput): Promise<Result<ComputeCBOutput>>;
}
export declare class GetAdjustedCB {
    private readonly compliance;
    constructor(compliance: IComplianceRepository);
    execute(input: GetAdjustedCBInput): Promise<Result<AdjustedCBOutput>>;
}
export declare class ListBankRecords {
    private readonly bank;
    constructor(bank: IBankRepository);
    execute(input: ListBankInput): Promise<Result<BankRecordsOutput>>;
}
export declare class BankSurplus {
    private readonly routes;
    private readonly compliance;
    private readonly bank;
    private readonly ids;
    constructor(routes: IRouteRepository, compliance: IComplianceRepository, bank: IBankRepository, ids: IIdGenerator);
    execute(input: BankSurplusInput): Promise<Result<BankSurplusOutput>>;
}
export declare class ApplyBankedCompliance {
    private readonly routes;
    private readonly compliance;
    private readonly bank;
    constructor(routes: IRouteRepository, compliance: IComplianceRepository, bank: IBankRepository);
    execute(input: ApplyBankedInput): Promise<Result<ApplyBankedOutput>>;
}
export declare class CreatePool {
    private readonly routes;
    private readonly compliance;
    private readonly bank;
    private readonly pools;
    private readonly ids;
    constructor(routes: IRouteRepository, compliance: IComplianceRepository, bank: IBankRepository, pools: IPoolRepository, ids: IIdGenerator);
    execute(input: CreatePoolInput): Promise<Result<CreatePoolOutput>>;
}
//# sourceMappingURL=application.d.ts.map