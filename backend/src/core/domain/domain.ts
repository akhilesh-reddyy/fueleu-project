// =============================================================================
// FuelEU Maritime — Domain Layer
// Rich entities: all business logic lives here, zero framework imports
// Field names mirror the assignment spec and schema.sql exactly
// =============================================================================

// ---------------------------------------------------------------------------
// Domain error types — typed, never raw strings
// ---------------------------------------------------------------------------

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class InvariantViolation extends DomainError {
  constructor(entity: string, rule: string) {
    super(`[${entity}] Invariant violated: ${rule}`);
    this.name = "InvariantViolation";
  }
}

// ---------------------------------------------------------------------------
// Shared types (align with schema enums)
// ---------------------------------------------------------------------------

export type VesselType = "Container" | "BulkCarrier" | "Tanker" | "RoRo" | "Cruise" | "Ferry";
export type FuelType   = "HFO" | "LNG" | "MGO" | "VLSFO" | "Methanol" | "Ammonia" | "Hydrogen";
export type BankStatus = "banked" | "partially_applied" | "fully_applied";

// =============================================================================
// CONSTANTS — Annex IV / FuelEU Maritime
// =============================================================================

export const FUEL_EU = {
  /** gCO₂e/MJ — 2% below the 91.16 reference value */
  TARGET_GHG_INTENSITY: 89.3368,
  /** MJ per metric tonne — lower heating value for typical marine fuels */
  LHV_MJ_PER_TONNE: 41_000,
} as const;

// =============================================================================
// ENTITY 1 — Route
//
// Stores one voyage record. Field names match the assignment spec exactly.
//
// Business behaviour:
//   - validate all invariants at construction (no silent partial objects)
//   - energyInScope()  → fuelConsumption × 41 000 MJ (used by CB formula)
//   - isCompliant()    → ghgIntensity <= TARGET_GHG_INTENSITY
//   - compareAgainst() → produces a RouteComparison value object
//   - setAsBaseline()  → returns a new immutable instance with flag set
// =============================================================================

export interface RouteProps {
  routeId:         string;   // e.g. "R001"
  vesselType:      VesselType;
  fuelType:        FuelType;
  year:            number;
  ghgIntensity:    number;   // gCO₂e/MJ
  fuelConsumption: number;   // metric tonnes
  distance:        number;   // kilometres
  totalEmissions:  number;   // metric tonnes CO₂e
}

export interface RouteComparison {
  baselineRouteId:     string;
  comparisonRouteId:   string;
  baselineIntensity:   number;
  comparisonIntensity: number;
  /** ((comparison / baseline) - 1) × 100 */
  percentDiff:         number;
  /** comparisonIntensity <= TARGET_GHG_INTENSITY */
  compliant:           boolean;
}

export class Route {
  readonly routeId:         string;
  readonly vesselType:      VesselType;
  readonly fuelType:        FuelType;
  readonly year:            number;
  readonly ghgIntensity:    number;
  readonly fuelConsumption: number;
  readonly distance:        number;
  readonly totalEmissions:  number;

  private readonly _isBaseline: boolean;

  private constructor(props: RouteProps, isBaseline: boolean) {
    Route.validate(props);
    this.routeId         = props.routeId;
    this.vesselType      = props.vesselType;
    this.fuelType        = props.fuelType;
    this.year            = props.year;
    this.ghgIntensity    = props.ghgIntensity;
    this.fuelConsumption = props.fuelConsumption;
    this.distance        = props.distance;
    this.totalEmissions  = props.totalEmissions;
    this._isBaseline     = isBaseline;
  }

  // ------------------------------------------------------------------
  // Factory
  // ------------------------------------------------------------------

  static create(props: RouteProps, isBaseline = false): Route {
    return new Route(props, isBaseline);
  }

  // ------------------------------------------------------------------
  // Invariants
  // ------------------------------------------------------------------

  private static validate(p: RouteProps): void {
    if (!p.routeId?.trim()) {
      throw new InvariantViolation("Route", "routeId must not be empty");
    }
    if (p.year < 2024 || p.year > 2050) {
      throw new InvariantViolation("Route", `year ${p.year} is outside the regulatory window 2024–2050`);
    }
    if (p.ghgIntensity <= 0) {
      throw new InvariantViolation("Route", "ghgIntensity must be > 0");
    }
    if (p.fuelConsumption <= 0) {
      throw new InvariantViolation("Route", "fuelConsumption must be > 0");
    }
    if (p.distance <= 0) {
      throw new InvariantViolation("Route", "distance must be > 0");
    }
    if (p.totalEmissions < 0) {
      throw new InvariantViolation("Route", "totalEmissions must be >= 0");
    }
  }

  // ------------------------------------------------------------------
  // Accessor
  // ------------------------------------------------------------------

  get isBaseline(): boolean { return this._isBaseline; }

  // ------------------------------------------------------------------
  // Domain behaviour
  // ------------------------------------------------------------------

  /**
   * Energy in scope (MJ) per Annex IV.
   * fuelConsumption (t) × 41 000 MJ/t
   * Used by ComplianceBalance.forRoute().
   */
  energyInScope(): number {
    return this.fuelConsumption * FUEL_EU.LHV_MJ_PER_TONNE;
  }

  /**
   * True when this route's GHG intensity is at or below the FuelEU target.
   */
  isCompliant(): boolean {
    return this.ghgIntensity <= FUEL_EU.TARGET_GHG_INTENSITY;
  }

  /**
   * Percent difference of this route vs a baseline route.
   * Formula: ((this / baseline) - 1) × 100
   */
  compareAgainst(baseline: Route): RouteComparison {
    if (baseline.ghgIntensity === 0) {
      throw new DomainError("Baseline GHG intensity cannot be zero");
    }
    const percentDiff =
      ((this.ghgIntensity / baseline.ghgIntensity) - 1) * 100;

    return {
      baselineRouteId:     baseline.routeId,
      comparisonRouteId:   this.routeId,
      baselineIntensity:   baseline.ghgIntensity,
      comparisonIntensity: this.ghgIntensity,
      percentDiff,
      compliant: this.isCompliant(),
    };
  }

  /** Returns a new Route with is_baseline = true. */
  setAsBaseline(): Route {
    return new Route(this.toProps(), true);
  }

  clearBaseline(): Route {
    return new Route(this.toProps(), false);
  }

  toProps(): RouteProps {
    return {
      routeId:         this.routeId,
      vesselType:      this.vesselType,
      fuelType:        this.fuelType,
      year:            this.year,
      ghgIntensity:    this.ghgIntensity,
      fuelConsumption: this.fuelConsumption,
      distance:        this.distance,
      totalEmissions:  this.totalEmissions,
    };
  }
}

// =============================================================================
// ENTITY 2 — ComplianceBalance
//
// Core FuelEU metric for one ship-year.
//
// Formula (Annex IV):
//   Energy (MJ) = fuelConsumption × 41 000
//   CB (gCO₂e)  = (Target − Actual) × Energy
//
//   CB > 0  →  Surplus  (greener than the target)
//   CB < 0  →  Deficit  (exceeds the target)
//   CB = 0  →  Exactly compliant
//
// The formula is private and called at construction —
// there is no way to construct a ComplianceBalance with an arbitrary CB value.
// =============================================================================

export interface CBSnapshot {
  shipId:    string;
  year:      number;
  routeId:   string;
  cbGco2eq:  number;
  isSurplus: boolean;
}

export class ComplianceBalance {
  /** CB in gCO₂e — computed once, immutable */
  readonly cb: number;

  private constructor(
    readonly shipId: string,
    readonly year:   number,
    readonly route:  Route,
  ) {
    if (!shipId?.trim()) {
      throw new InvariantViolation("ComplianceBalance", "shipId must not be empty");
    }
    if (year < 2024 || year > 2050) {
      throw new InvariantViolation("ComplianceBalance", `year ${year} outside regulatory window`);
    }
    // Formula lives here — not in any service or use-case
    this.cb = ComplianceBalance.compute(route);
  }

  // ------------------------------------------------------------------
  // Factory
  // ------------------------------------------------------------------

  static forRoute(shipId: string, year: number, route: Route): ComplianceBalance {
    return new ComplianceBalance(shipId, year, route);
  }

  // ------------------------------------------------------------------
  // CB formula — private, called at construction
  //
  //   Energy     =  fuelConsumption × LHV_MJ_PER_TONNE
  //   CB         =  (TARGET_GHG_INTENSITY − ghgIntensity) × Energy
  // ------------------------------------------------------------------

  private static compute(route: Route): number {
    const energy = route.energyInScope();                            // MJ
    const delta  = FUEL_EU.TARGET_GHG_INTENSITY - route.ghgIntensity; // gCO₂e/MJ
    return delta * energy;                                           // gCO₂e
  }

  // ------------------------------------------------------------------
  // Classification helpers
  // ------------------------------------------------------------------

  isSurplus(): boolean { return this.cb >  0; }
  isDeficit(): boolean { return this.cb <  0; }
  isExact():   boolean { return this.cb === 0; }

  // ------------------------------------------------------------------
  // Domain behaviour: apply banked credits
  // ------------------------------------------------------------------

  /**
   * Applies banked credits to reduce a deficit.
   * Enforces two rules without delegating to a service:
   *   1. bankedAmount must be ≥ 0
   *   2. cannot apply more than the absolute deficit
   * Returns an AdjustedCB value object; this instance is unchanged.
   */
  applyBanked(bankedAmount: number): AdjustedCB {
    if (bankedAmount < 0) {
      throw new DomainError("bankedAmount must be ≥ 0");
    }
    if (!this.isDeficit()) {
      throw new DomainError(
        `Ship ${this.shipId} is not in deficit (CB = ${this.cb.toFixed(2)} gCO₂e); ` +
        `banking application is only valid for deficit ships`
      );
    }
    const maxApplicable = Math.abs(this.cb);
    if (bankedAmount > maxApplicable + 1e-9) {
      throw new DomainError(
        `Cannot apply ${bankedAmount.toFixed(2)} gCO₂e: ` +
        `exceeds deficit of ${maxApplicable.toFixed(2)} gCO₂e`
      );
    }
    return new AdjustedCB(this, bankedAmount);
  }

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------

  toSnapshot(): CBSnapshot {
    return {
      shipId:    this.shipId,
      year:      this.year,
      routeId:   this.route.routeId,
      cbGco2eq:  this.cb,
      isSurplus: this.isSurplus(),
    };
  }
}

/**
 * AdjustedCB — value object produced by ComplianceBalance.applyBanked().
 * Carries cbBefore, applied, and cbAfter as an atomic record.
 */
export class AdjustedCB {
  readonly cbBefore: number;
  readonly applied:  number;
  readonly cbAfter:  number;

  constructor(
    readonly source: ComplianceBalance,
    applied: number,
  ) {
    this.cbBefore = source.cb;
    this.applied  = applied;
    this.cbAfter  = source.cb + applied;
  }

  get shipId() { return this.source.shipId; }
  get year()   { return this.source.year;   }
}

// =============================================================================
// ENTITY 3 — BankEntry
//
// Article 20 — records surplus CB banked by a ship.
//
// Invariants enforced at construction:
//   - id and shipId non-empty, year in range
//   - amountGco2eq > 0  (only surplus can be banked)
//
// Lifecycle invariants enforced on apply():
//   - closed entries reject further apply() calls
//   - applied amount never exceeds banked amount
//
// The factory BankEntry.bank() rejects deficit CB at the boundary so callers
// never need to check — a BankEntry that exists always represents valid surplus.
// =============================================================================

export class BankEntry {
  /** Mutable: grows with each apply() call */
  private _appliedAmount: number = 0;

  private constructor(
    readonly id:           string,
    readonly shipId:       string,
    readonly year:         number,
    readonly amountGco2eq: number,
  ) {
    if (!id?.trim()) {
      throw new InvariantViolation("BankEntry", "id must not be empty");
    }
    if (!shipId?.trim()) {
      throw new InvariantViolation("BankEntry", "shipId must not be empty");
    }
    if (year < 2024 || year > 2050) {
      throw new InvariantViolation("BankEntry", `year ${year} outside regulatory window`);
    }
    if (amountGco2eq <= 0) {
      throw new InvariantViolation("BankEntry", "only positive CB (surplus) may be banked");
    }
  }

  // ------------------------------------------------------------------
  // Factory — rejects deficit at the domain boundary
  // ------------------------------------------------------------------

  static bank(id: string, cb: ComplianceBalance): BankEntry {
    if (!cb.isSurplus()) {
      throw new DomainError(
        `Ship ${cb.shipId} has a deficit CB of ${cb.cb.toFixed(2)} gCO₂e; ` +
        `only surplus can be banked (Article 20)`
      );
    }
    return new BankEntry(id, cb.shipId, cb.year, cb.cb);
  }

  // ------------------------------------------------------------------
  // Accessors
  // ------------------------------------------------------------------

  get appliedAmount():    number { return this._appliedAmount; }
  get availableBalance(): number { return this.amountGco2eq - this._appliedAmount; }

  status(): BankStatus {
    if (this._appliedAmount === 0)                          return "banked";
    if (this._appliedAmount >= this.amountGco2eq - 1e-9)    return "fully_applied";
    return "partially_applied";
  }

  isClosed(): boolean {
    return this.status() === "fully_applied";
  }

  // ------------------------------------------------------------------
  // Domain behaviour
  // ------------------------------------------------------------------

  /**
   * Draws up to `requested` gCO₂e from this entry's available balance.
   * Returns the actual amount consumed — may be < requested when the
   * entry runs dry. Callers (ApplyBankedCompliance use-case) iterate FIFO
   * across entries and accumulate the returned values.
   */
  apply(requested: number): number {
    if (this.isClosed()) {
      throw new DomainError(`BankEntry ${this.id} is fully applied; no balance remains`);
    }
    if (requested <= 0) {
      throw new DomainError("Amount to apply must be > 0");
    }
    const actual = Math.min(requested, this.availableBalance);
    this._appliedAmount += actual;
    return actual;
  }
}

// =============================================================================
// ENTITY 4 — Pool
//
// Article 21 — a compliance pool sharing CB across ships.
//
// Pre-conditions (checked before allocation):
//   1. id non-empty, year in range
//   2. ≥ 2 members, no duplicate shipIds
//   3. ∑ adjustedCb ≥ 0  (pool cannot be in collective deficit)
//
// Post-conditions (checked after greedy allocation):
//   4. No deficit ship exits worse than it entered
//   5. No surplus ship exits with a negative CB
//
// Greedy allocation (sort desc by CB → drain surplus into deficits):
//   - Iterate surplus ships from the top
//   - For each surplus ship, scan deficit ships from the bottom
//   - Transfer min(deficit, available) at each step
//   - Repeat until all deficits are covered or all surplus is consumed
//
// Pool is immutable after creation — all allocations are sealed.
// =============================================================================

export interface PoolMemberInput {
  shipId:     string;
  adjustedCb: number;   // CB after any banking has been applied
}

export interface PoolMemberResult {
  shipId:   string;
  cbBefore: number;
  cbAfter:  number;
  /** positive = received surplus from others; negative = donated to others */
  transfer: number;
}

export class Pool {
  private readonly _members: PoolMemberResult[];

  private constructor(
    readonly id:   string,
    readonly year: number,
    members: PoolMemberResult[],
  ) {
    this._members = members;
  }

  // ------------------------------------------------------------------
  // Factory — validate, allocate, validate again, then construct
  // ------------------------------------------------------------------

  static create(id: string, year: number, inputs: PoolMemberInput[]): Pool {
    Pool.checkPreConditions(id, year, inputs);
    const allocated = Pool.greedyAllocate(inputs);
    Pool.checkPostConditions(inputs, allocated);
    return new Pool(id, year, allocated);
  }

  // ------------------------------------------------------------------
  // Pre-conditions
  // ------------------------------------------------------------------

  private static checkPreConditions(
    id:     string,
    year:   number,
    inputs: PoolMemberInput[],
  ): void {
    if (!id?.trim()) {
      throw new InvariantViolation("Pool", "id must not be empty");
    }
    if (year < 2024 || year > 2050) {
      throw new InvariantViolation("Pool", `year ${year} outside regulatory window`);
    }
    if (inputs.length < 2) {
      throw new InvariantViolation("Pool", "a pool must have at least 2 members");
    }

    const seen = new Set<string>();
    for (const m of inputs) {
      if (!m.shipId?.trim()) {
        throw new InvariantViolation("Pool", "every member must have a non-empty shipId");
      }
      if (seen.has(m.shipId)) {
        throw new InvariantViolation("Pool", `duplicate shipId '${m.shipId}'`);
      }
      seen.add(m.shipId);
    }

    const sumCB = inputs.reduce((acc, m) => acc + m.adjustedCb, 0);
    if (sumCB < -1e-9) {
      throw new InvariantViolation(
        "Pool",
        `∑ adjustedCB = ${sumCB.toFixed(4)} gCO₂e — pool cannot be in collective deficit (Article 21)`
      );
    }
  }

  // ------------------------------------------------------------------
  // Greedy allocation
  // ------------------------------------------------------------------

  private static greedyAllocate(inputs: PoolMemberInput[]): PoolMemberResult[] {
    const working = inputs
      .map(m => ({ shipId: m.shipId, cbBefore: m.adjustedCb, cbAfter: m.adjustedCb }))
      .sort((a, b) => b.cbAfter - a.cbAfter);   // descending — biggest surplus first

    for (let i = 0; i < working.length; i++) {
      const donor = working[i];
      if (donor.cbAfter <= 1e-9) break;          // no surplus left at the top

      for (let j = working.length - 1; j > i; j--) {
        const recipient = working[j];
        if (recipient.cbAfter >= -1e-9) continue; // not in deficit

        const deficit  = Math.abs(recipient.cbAfter);
        const transfer = Math.min(deficit, donor.cbAfter);

        donor.cbAfter     -= transfer;
        recipient.cbAfter += transfer;

        if (donor.cbAfter <= 1e-9) break;         // donor exhausted
      }
    }

    return working.map(w => ({
      shipId:   w.shipId,
      cbBefore: w.cbBefore,
      cbAfter:  w.cbAfter,
      transfer: w.cbAfter - w.cbBefore,
    }));
  }

  // ------------------------------------------------------------------
  // Post-conditions
  // ------------------------------------------------------------------

  private static checkPostConditions(
    inputs:  PoolMemberInput[],
    results: PoolMemberResult[],
  ): void {
    const inputMap = new Map(inputs.map(m => [m.shipId, m.adjustedCb]));

    for (const r of results) {
      const before = inputMap.get(r.shipId)!;

      // Rule: deficit ship must not exit worse than it entered
      if (before < 0 && r.cbAfter < before - 1e-9) {
        throw new InvariantViolation(
          "Pool",
          `Ship ${r.shipId} enters with deficit ${before.toFixed(2)} ` +
          `and exits worse at ${r.cbAfter.toFixed(2)}`
        );
      }
      // Rule: surplus ship must not exit with a negative CB
      if (before > 0 && r.cbAfter < -1e-9) {
        throw new InvariantViolation(
          "Pool",
          `Surplus ship ${r.shipId} exits with negative CB ${r.cbAfter.toFixed(2)}`
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // Accessors
  // ------------------------------------------------------------------

  get members(): readonly PoolMemberResult[] { return this._members; }

  memberResult(shipId: string): PoolMemberResult | undefined {
    return this._members.find(m => m.shipId === shipId);
  }

  /** ∑ cbAfter — must be ≥ 0 by the pre-condition invariant */
  poolSum(): number {
    return this._members.reduce((acc, m) => acc + m.cbAfter, 0);
  }

  isBalanced(): boolean { return this.poolSum() >= -1e-9; }
}
