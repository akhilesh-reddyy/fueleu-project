"use strict";
// =============================================================================
// FuelEU Maritime — Domain Layer
// Rich entities: all business logic lives here, zero framework imports
// Field names mirror the assignment spec and schema.sql exactly
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pool = exports.BankEntry = exports.AdjustedCB = exports.ComplianceBalance = exports.Route = exports.FUEL_EU = exports.InvariantViolation = exports.DomainError = void 0;
// ---------------------------------------------------------------------------
// Domain error types — typed, never raw strings
// ---------------------------------------------------------------------------
class DomainError extends Error {
    constructor(message) {
        super(message);
        this.name = "DomainError";
    }
}
exports.DomainError = DomainError;
class InvariantViolation extends DomainError {
    constructor(entity, rule) {
        super(`[${entity}] Invariant violated: ${rule}`);
        this.name = "InvariantViolation";
    }
}
exports.InvariantViolation = InvariantViolation;
// =============================================================================
// CONSTANTS — Annex IV / FuelEU Maritime
// =============================================================================
exports.FUEL_EU = {
    /** gCO₂e/MJ — 2% below the 91.16 reference value */
    TARGET_GHG_INTENSITY: 89.3368,
    /** MJ per metric tonne — lower heating value for typical marine fuels */
    LHV_MJ_PER_TONNE: 41_000,
};
class Route {
    routeId;
    vesselType;
    fuelType;
    year;
    ghgIntensity;
    fuelConsumption;
    distance;
    totalEmissions;
    _isBaseline;
    constructor(props, isBaseline) {
        Route.validate(props);
        this.routeId = props.routeId;
        this.vesselType = props.vesselType;
        this.fuelType = props.fuelType;
        this.year = props.year;
        this.ghgIntensity = props.ghgIntensity;
        this.fuelConsumption = props.fuelConsumption;
        this.distance = props.distance;
        this.totalEmissions = props.totalEmissions;
        this._isBaseline = isBaseline;
    }
    // ------------------------------------------------------------------
    // Factory
    // ------------------------------------------------------------------
    static create(props, isBaseline = false) {
        return new Route(props, isBaseline);
    }
    // ------------------------------------------------------------------
    // Invariants
    // ------------------------------------------------------------------
    static validate(p) {
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
    get isBaseline() { return this._isBaseline; }
    // ------------------------------------------------------------------
    // Domain behaviour
    // ------------------------------------------------------------------
    /**
     * Energy in scope (MJ) per Annex IV.
     * fuelConsumption (t) × 41 000 MJ/t
     * Used by ComplianceBalance.forRoute().
     */
    energyInScope() {
        return this.fuelConsumption * exports.FUEL_EU.LHV_MJ_PER_TONNE;
    }
    /**
     * True when this route's GHG intensity is at or below the FuelEU target.
     */
    isCompliant() {
        return this.ghgIntensity <= exports.FUEL_EU.TARGET_GHG_INTENSITY;
    }
    /**
     * Percent difference of this route vs a baseline route.
     * Formula: ((this / baseline) - 1) × 100
     */
    compareAgainst(baseline) {
        if (baseline.ghgIntensity === 0) {
            throw new DomainError("Baseline GHG intensity cannot be zero");
        }
        const percentDiff = ((this.ghgIntensity / baseline.ghgIntensity) - 1) * 100;
        return {
            baselineRouteId: baseline.routeId,
            comparisonRouteId: this.routeId,
            baselineIntensity: baseline.ghgIntensity,
            comparisonIntensity: this.ghgIntensity,
            percentDiff,
            compliant: this.isCompliant(),
        };
    }
    /** Returns a new Route with is_baseline = true. */
    setAsBaseline() {
        return new Route(this.toProps(), true);
    }
    clearBaseline() {
        return new Route(this.toProps(), false);
    }
    toProps() {
        return {
            routeId: this.routeId,
            vesselType: this.vesselType,
            fuelType: this.fuelType,
            year: this.year,
            ghgIntensity: this.ghgIntensity,
            fuelConsumption: this.fuelConsumption,
            distance: this.distance,
            totalEmissions: this.totalEmissions,
        };
    }
}
exports.Route = Route;
class ComplianceBalance {
    shipId;
    year;
    route;
    /** CB in gCO₂e — computed once, immutable */
    cb;
    constructor(shipId, year, route) {
        this.shipId = shipId;
        this.year = year;
        this.route = route;
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
    static forRoute(shipId, year, route) {
        return new ComplianceBalance(shipId, year, route);
    }
    // ------------------------------------------------------------------
    // CB formula — private, called at construction
    //
    //   Energy     =  fuelConsumption × LHV_MJ_PER_TONNE
    //   CB         =  (TARGET_GHG_INTENSITY − ghgIntensity) × Energy
    // ------------------------------------------------------------------
    static compute(route) {
        const energy = route.energyInScope(); // MJ
        const delta = exports.FUEL_EU.TARGET_GHG_INTENSITY - route.ghgIntensity; // gCO₂e/MJ
        return delta * energy; // gCO₂e
    }
    // ------------------------------------------------------------------
    // Classification helpers
    // ------------------------------------------------------------------
    isSurplus() { return this.cb > 0; }
    isDeficit() { return this.cb < 0; }
    isExact() { return this.cb === 0; }
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
    applyBanked(bankedAmount) {
        if (bankedAmount < 0) {
            throw new DomainError("bankedAmount must be ≥ 0");
        }
        if (!this.isDeficit()) {
            throw new DomainError(`Ship ${this.shipId} is not in deficit (CB = ${this.cb.toFixed(2)} gCO₂e); ` +
                `banking application is only valid for deficit ships`);
        }
        const maxApplicable = Math.abs(this.cb);
        if (bankedAmount > maxApplicable + 1e-9) {
            throw new DomainError(`Cannot apply ${bankedAmount.toFixed(2)} gCO₂e: ` +
                `exceeds deficit of ${maxApplicable.toFixed(2)} gCO₂e`);
        }
        return new AdjustedCB(this, bankedAmount);
    }
    // ------------------------------------------------------------------
    // Persistence
    // ------------------------------------------------------------------
    toSnapshot() {
        return {
            shipId: this.shipId,
            year: this.year,
            routeId: this.route.routeId,
            cbGco2eq: this.cb,
            isSurplus: this.isSurplus(),
        };
    }
}
exports.ComplianceBalance = ComplianceBalance;
/**
 * AdjustedCB — value object produced by ComplianceBalance.applyBanked().
 * Carries cbBefore, applied, and cbAfter as an atomic record.
 */
class AdjustedCB {
    source;
    cbBefore;
    applied;
    cbAfter;
    constructor(source, applied) {
        this.source = source;
        this.cbBefore = source.cb;
        this.applied = applied;
        this.cbAfter = source.cb + applied;
    }
    get shipId() { return this.source.shipId; }
    get year() { return this.source.year; }
}
exports.AdjustedCB = AdjustedCB;
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
class BankEntry {
    id;
    shipId;
    year;
    amountGco2eq;
    /** Mutable: grows with each apply() call */
    _appliedAmount = 0;
    constructor(id, shipId, year, amountGco2eq) {
        this.id = id;
        this.shipId = shipId;
        this.year = year;
        this.amountGco2eq = amountGco2eq;
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
    static bank(id, cb) {
        if (!cb.isSurplus()) {
            throw new DomainError(`Ship ${cb.shipId} has a deficit CB of ${cb.cb.toFixed(2)} gCO₂e; ` +
                `only surplus can be banked (Article 20)`);
        }
        return new BankEntry(id, cb.shipId, cb.year, cb.cb);
    }
    // ------------------------------------------------------------------
    // Accessors
    // ------------------------------------------------------------------
    get appliedAmount() { return this._appliedAmount; }
    get availableBalance() { return this.amountGco2eq - this._appliedAmount; }
    status() {
        if (this._appliedAmount === 0)
            return "banked";
        if (this._appliedAmount >= this.amountGco2eq - 1e-9)
            return "fully_applied";
        return "partially_applied";
    }
    isClosed() {
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
    apply(requested) {
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
exports.BankEntry = BankEntry;
class Pool {
    id;
    year;
    _members;
    constructor(id, year, members) {
        this.id = id;
        this.year = year;
        this._members = members;
    }
    // ------------------------------------------------------------------
    // Factory — validate, allocate, validate again, then construct
    // ------------------------------------------------------------------
    static create(id, year, inputs) {
        Pool.checkPreConditions(id, year, inputs);
        const allocated = Pool.greedyAllocate(inputs);
        Pool.checkPostConditions(inputs, allocated);
        return new Pool(id, year, allocated);
    }
    // ------------------------------------------------------------------
    // Pre-conditions
    // ------------------------------------------------------------------
    static checkPreConditions(id, year, inputs) {
        if (!id?.trim()) {
            throw new InvariantViolation("Pool", "id must not be empty");
        }
        if (year < 2024 || year > 2050) {
            throw new InvariantViolation("Pool", `year ${year} outside regulatory window`);
        }
        if (inputs.length < 2) {
            throw new InvariantViolation("Pool", "a pool must have at least 2 members");
        }
        const seen = new Set();
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
            throw new InvariantViolation("Pool", `∑ adjustedCB = ${sumCB.toFixed(4)} gCO₂e — pool cannot be in collective deficit (Article 21)`);
        }
    }
    // ------------------------------------------------------------------
    // Greedy allocation
    // ------------------------------------------------------------------
    static greedyAllocate(inputs) {
        const working = inputs
            .map(m => ({ shipId: m.shipId, cbBefore: m.adjustedCb, cbAfter: m.adjustedCb }))
            .sort((a, b) => b.cbAfter - a.cbAfter); // descending — biggest surplus first
        for (let i = 0; i < working.length; i++) {
            const donor = working[i];
            if (donor.cbAfter <= 1e-9)
                break; // no surplus left at the top
            for (let j = working.length - 1; j > i; j--) {
                const recipient = working[j];
                if (recipient.cbAfter >= -1e-9)
                    continue; // not in deficit
                const deficit = Math.abs(recipient.cbAfter);
                const transfer = Math.min(deficit, donor.cbAfter);
                donor.cbAfter -= transfer;
                recipient.cbAfter += transfer;
                if (donor.cbAfter <= 1e-9)
                    break; // donor exhausted
            }
        }
        return working.map(w => ({
            shipId: w.shipId,
            cbBefore: w.cbBefore,
            cbAfter: w.cbAfter,
            transfer: w.cbAfter - w.cbBefore,
        }));
    }
    // ------------------------------------------------------------------
    // Post-conditions
    // ------------------------------------------------------------------
    static checkPostConditions(inputs, results) {
        const inputMap = new Map(inputs.map(m => [m.shipId, m.adjustedCb]));
        for (const r of results) {
            const before = inputMap.get(r.shipId);
            // Rule: deficit ship must not exit worse than it entered
            if (before < 0 && r.cbAfter < before - 1e-9) {
                throw new InvariantViolation("Pool", `Ship ${r.shipId} enters with deficit ${before.toFixed(2)} ` +
                    `and exits worse at ${r.cbAfter.toFixed(2)}`);
            }
            // Rule: surplus ship must not exit with a negative CB
            if (before > 0 && r.cbAfter < -1e-9) {
                throw new InvariantViolation("Pool", `Surplus ship ${r.shipId} exits with negative CB ${r.cbAfter.toFixed(2)}`);
            }
        }
    }
    // ------------------------------------------------------------------
    // Accessors
    // ------------------------------------------------------------------
    get members() { return this._members; }
    memberResult(shipId) {
        return this._members.find(m => m.shipId === shipId);
    }
    /** ∑ cbAfter — must be ≥ 0 by the pre-condition invariant */
    poolSum() {
        return this._members.reduce((acc, m) => acc + m.cbAfter, 0);
    }
    isBalanced() { return this.poolSum() >= -1e-9; }
}
exports.Pool = Pool;
//# sourceMappingURL=domain.js.map