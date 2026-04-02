export declare class DomainError extends Error {
    constructor(message: string);
}
export declare class InvariantViolation extends DomainError {
    constructor(entity: string, rule: string);
}
export type VesselType = "Container" | "BulkCarrier" | "Tanker" | "RoRo" | "Cruise" | "Ferry";
export type FuelType = "HFO" | "LNG" | "MGO" | "VLSFO" | "Methanol" | "Ammonia" | "Hydrogen";
export type BankStatus = "banked" | "partially_applied" | "fully_applied";
export declare const FUEL_EU: {
    /** gCO₂e/MJ — 2% below the 91.16 reference value */
    readonly TARGET_GHG_INTENSITY: 89.3368;
    /** MJ per metric tonne — lower heating value for typical marine fuels */
    readonly LHV_MJ_PER_TONNE: 41000;
};
export interface RouteProps {
    routeId: string;
    vesselType: VesselType;
    fuelType: FuelType;
    year: number;
    ghgIntensity: number;
    fuelConsumption: number;
    distance: number;
    totalEmissions: number;
}
export interface RouteComparison {
    baselineRouteId: string;
    comparisonRouteId: string;
    baselineIntensity: number;
    comparisonIntensity: number;
    /** ((comparison / baseline) - 1) × 100 */
    percentDiff: number;
    /** comparisonIntensity <= TARGET_GHG_INTENSITY */
    compliant: boolean;
}
export declare class Route {
    readonly routeId: string;
    readonly vesselType: VesselType;
    readonly fuelType: FuelType;
    readonly year: number;
    readonly ghgIntensity: number;
    readonly fuelConsumption: number;
    readonly distance: number;
    readonly totalEmissions: number;
    private readonly _isBaseline;
    private constructor();
    static create(props: RouteProps, isBaseline?: boolean): Route;
    private static validate;
    get isBaseline(): boolean;
    /**
     * Energy in scope (MJ) per Annex IV.
     * fuelConsumption (t) × 41 000 MJ/t
     * Used by ComplianceBalance.forRoute().
     */
    energyInScope(): number;
    /**
     * True when this route's GHG intensity is at or below the FuelEU target.
     */
    isCompliant(): boolean;
    /**
     * Percent difference of this route vs a baseline route.
     * Formula: ((this / baseline) - 1) × 100
     */
    compareAgainst(baseline: Route): RouteComparison;
    /** Returns a new Route with is_baseline = true. */
    setAsBaseline(): Route;
    clearBaseline(): Route;
    toProps(): RouteProps;
}
export interface CBSnapshot {
    shipId: string;
    year: number;
    routeId: string;
    cbGco2eq: number;
    isSurplus: boolean;
}
export declare class ComplianceBalance {
    readonly shipId: string;
    readonly year: number;
    readonly route: Route;
    /** CB in gCO₂e — computed once, immutable */
    readonly cb: number;
    private constructor();
    static forRoute(shipId: string, year: number, route: Route): ComplianceBalance;
    private static compute;
    isSurplus(): boolean;
    isDeficit(): boolean;
    isExact(): boolean;
    /**
     * Applies banked credits to reduce a deficit.
     * Enforces two rules without delegating to a service:
     *   1. bankedAmount must be ≥ 0
     *   2. cannot apply more than the absolute deficit
     * Returns an AdjustedCB value object; this instance is unchanged.
     */
    applyBanked(bankedAmount: number): AdjustedCB;
    toSnapshot(): CBSnapshot;
}
/**
 * AdjustedCB — value object produced by ComplianceBalance.applyBanked().
 * Carries cbBefore, applied, and cbAfter as an atomic record.
 */
export declare class AdjustedCB {
    readonly source: ComplianceBalance;
    readonly cbBefore: number;
    readonly applied: number;
    readonly cbAfter: number;
    constructor(source: ComplianceBalance, applied: number);
    get shipId(): string;
    get year(): number;
}
export declare class BankEntry {
    readonly id: string;
    readonly shipId: string;
    readonly year: number;
    readonly amountGco2eq: number;
    /** Mutable: grows with each apply() call */
    private _appliedAmount;
    private constructor();
    static bank(id: string, cb: ComplianceBalance): BankEntry;
    get appliedAmount(): number;
    get availableBalance(): number;
    status(): BankStatus;
    isClosed(): boolean;
    /**
     * Draws up to `requested` gCO₂e from this entry's available balance.
     * Returns the actual amount consumed — may be < requested when the
     * entry runs dry. Callers (ApplyBankedCompliance use-case) iterate FIFO
     * across entries and accumulate the returned values.
     */
    apply(requested: number): number;
}
export interface PoolMemberInput {
    shipId: string;
    adjustedCb: number;
}
export interface PoolMemberResult {
    shipId: string;
    cbBefore: number;
    cbAfter: number;
    /** positive = received surplus from others; negative = donated to others */
    transfer: number;
}
export declare class Pool {
    readonly id: string;
    readonly year: number;
    private readonly _members;
    private constructor();
    static create(id: string, year: number, inputs: PoolMemberInput[]): Pool;
    private static checkPreConditions;
    private static greedyAllocate;
    private static checkPostConditions;
    get members(): readonly PoolMemberResult[];
    memberResult(shipId: string): PoolMemberResult | undefined;
    /** ∑ cbAfter — must be ≥ 0 by the pre-condition invariant */
    poolSum(): number;
    isBalanced(): boolean;
}
//# sourceMappingURL=domain.d.ts.map