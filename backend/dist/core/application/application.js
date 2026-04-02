"use strict";
// =============================================================================
// FuelEU Maritime — Application Layer
// Use-cases + Ports + DTOs + Repository Mappers
//
// Rules enforced here:
//   1. Use-cases only orchestrate — ALL logic delegated to domain entities
//   2. No arithmetic, no business rules, no domain constants
//   3. No Prisma, no SQL, no framework imports
//   4. Every use-case returns Result<T, ApplicationError>
//   5. Domain throws (InvariantViolation / DomainError) are caught and
//      converted to typed ApplicationError at the boundary — never leaked
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePool = exports.ApplyBankedCompliance = exports.BankSurplus = exports.ListBankRecords = exports.GetAdjustedCB = exports.ComputeComplianceBalance = exports.GetComparison = exports.SetBaseline = exports.ListRoutes = exports.PoolMapper = exports.BankEntryMapper = exports.ComplianceMapper = exports.RouteMapper = exports.conflict = exports.validation = exports.domainRule = exports.notFound = exports.err = exports.ok = void 0;
const domain_1 = require("./domain");
const ok = (value) => ({ ok: true, value });
exports.ok = ok;
const err = (error) => ({ ok: false, error });
exports.err = err;
const notFound = (entity, id) => ({ code: "NOT_FOUND", message: `${entity} '${id}' not found`, entity, id });
exports.notFound = notFound;
const domainRule = (message) => ({ code: "DOMAIN_RULE", message });
exports.domainRule = domainRule;
const validation = (field, message) => ({ code: "VALIDATION", message, field });
exports.validation = validation;
const conflict = (message) => ({ code: "CONFLICT", message });
exports.conflict = conflict;
/**
 * Wraps any domain throw (InvariantViolation / DomainError) into a Result.
 * Only domain errors are swallowed — unexpected errors re-throw upward.
 */
function guard(fn) {
    try {
        return (0, exports.ok)(fn());
    }
    catch (e) {
        if (e instanceof domain_1.InvariantViolation || e instanceof domain_1.DomainError) {
            return (0, exports.err)((0, exports.domainRule)(e.message));
        }
        throw e;
    }
}
// =============================================================================
// SECTION 3 — Repository Mappers
//
// Single source of truth for DB ↔ domain translation.
// Imported by Postgres adapters — never by domain entities or use-cases.
//
// Each mapper is a plain object with two static-style functions:
//   toDomain(row)  — DB row  → domain entity
//   toRow(entity)  — domain  → DB insert/update shape
// =============================================================================
/** Parse Prisma Decimal (may arrive as string) to JS number */
const toNum = (v) => typeof v === "string" ? parseFloat(v) : v;
// ---------------------------------------------------------------------------
// RouteMapper
// ---------------------------------------------------------------------------
exports.RouteMapper = {
    /**
     * DB row → Route domain entity
     * Maps snake_case column names to the camelCase RouteProps the domain expects.
     */
    toDomain(row) {
        const props = {
            routeId: row.route_id,
            vesselType: row.vessel_type,
            fuelType: row.fuel_type,
            year: row.year,
            ghgIntensity: toNum(row.ghg_intensity),
            fuelConsumption: toNum(row.fuel_consumption),
            distance: toNum(row.distance),
            totalEmissions: toNum(row.total_emissions),
        };
        return domain_1.Route.create(props, row.is_baseline);
    },
    /**
     * Route domain entity → DB insert shape (snake_case)
     * Used by IRouteRepository.save() implementations.
     */
    toRow(route) {
        return {
            route_id: route.routeId,
            vessel_type: route.vesselType,
            fuel_type: route.fuelType,
            year: route.year,
            ghg_intensity: route.ghgIntensity,
            fuel_consumption: route.fuelConsumption,
            distance: route.distance,
            total_emissions: route.totalEmissions,
            is_baseline: route.isBaseline,
        };
    },
};
// ---------------------------------------------------------------------------
// ComplianceMapper
// ---------------------------------------------------------------------------
exports.ComplianceMapper = {
    /**
     * DB row → CBSnapshot (plain object used by use-cases and repositories).
     * ComplianceBalance is rehydrated from a Route — not from a snapshot row —
     * because the formula must always be re-derivable from first principles.
     */
    toSnapshot(row) {
        return {
            shipId: row.ship_id,
            year: row.year,
            routeId: row.route_id, // stores the natural route_id, not the UUID
            cbGco2eq: toNum(row.cb_gco2eq),
            isSurplus: row.is_surplus,
        };
    },
    /**
     * CBSnapshot → DB insert shape.
     * is_surplus is a GENERATED ALWAYS column — omitted from insert.
     */
    toRow(snapshot) {
        return {
            ship_id: snapshot.shipId,
            year: snapshot.year,
            route_id: snapshot.routeId,
            cb_gco2eq: snapshot.cbGco2eq,
        };
    },
};
// ---------------------------------------------------------------------------
// BankEntryMapper
// ---------------------------------------------------------------------------
exports.BankEntryMapper = {
    /**
     * DB row → BankEntry domain entity.
     * BankEntry has a private constructor — we use the internal rehydration
     * path via Object.assign to restore applied state without re-running
     * the bank() factory (which would reject non-zero applied amounts).
     */
    toDomain(row) {
        // Create via factory with the original amount
        const cb = {
            shipId: row.ship_id,
            year: row.year,
            cb: toNum(row.amount_gco2eq),
            isSurplus: () => true,
        };
        const entry = domain_1.BankEntry.bank(row.id, cb);
        // Restore the applied amount that has accumulated since creation.
        // We reach into the private field only in this mapper — the domain
        // entity itself never exposes a setter.
        const applied = toNum(row.applied_gco2eq);
        if (applied > 0) {
            // Replay the apply() calls by calling apply() with the already-applied total.
            // This is safe: amount_gco2eq > applied is enforced by schema CHECK constraint.
            entry._appliedAmount = applied;
        }
        return entry;
    },
    /**
     * BankEntry domain entity → DB update shape (status + applied_gco2eq).
     * amount_gco2eq and ship_id never change after creation.
     */
    toUpdateRow(entry) {
        return {
            applied_gco2eq: entry.appliedAmount,
            status: entry.status(),
        };
    },
    /**
     * BankEntry → full DB insert shape (used on first save).
     */
    toInsertRow(entry) {
        return {
            ship_id: entry.shipId,
            year: entry.year,
            amount_gco2eq: entry.amountGco2eq,
            applied_gco2eq: entry.appliedAmount,
            status: entry.status(),
        };
    },
};
// ---------------------------------------------------------------------------
// PoolMapper
// ---------------------------------------------------------------------------
exports.PoolMapper = {
    /**
     * Pool domain entity → DB insert shape for the pools header row.
     */
    toPoolRow(pool) {
        return {
            year: pool.year,
            pool_sum: pool.poolSum(),
        };
    },
    /**
     * Pool domain entity → array of DB insert shapes for pool_members.
     */
    toMemberRows(pool) {
        return pool.members.map(m => ({
            pool_id: pool.id,
            ship_id: m.shipId,
            cb_before: m.cbBefore,
            cb_after: m.cbAfter,
            transfer: m.transfer,
        }));
    },
};
// =============================================================================
// SECTION 6 — Domain → DTO mappers (keep controllers thin)
// =============================================================================
function routeToDTO(route) {
    return {
        routeId: route.routeId,
        vesselType: route.vesselType,
        fuelType: route.fuelType,
        year: route.year,
        ghgIntensity: route.ghgIntensity,
        fuelConsumption: route.fuelConsumption,
        distance: route.distance,
        totalEmissions: route.totalEmissions,
        isBaseline: route.isBaseline,
        isCompliant: route.isCompliant(), // domain behaviour called here
        energyInScopeMJ: route.energyInScope(), // domain behaviour called here
    };
}
function bankEntryToDTO(entry) {
    return {
        id: entry.id,
        shipId: entry.shipId,
        year: entry.year,
        amountGco2eq: entry.amountGco2eq,
        appliedGco2eq: entry.appliedAmount,
        availableBalance: entry.availableBalance,
        status: entry.status(),
    };
}
// =============================================================================
// SECTION 7 — Use-case: ListRoutes
// Orchestration: filters → repo → map to DTOs
// =============================================================================
class ListRoutes {
    routes;
    constructor(routes) {
        this.routes = routes;
    }
    async execute(filters) {
        const routes = await this.routes.findAll(filters);
        return (0, exports.ok)({ routes: routes.map(routeToDTO) });
    }
}
exports.ListRoutes = ListRoutes;
// =============================================================================
// SECTION 8 — Use-case: SetBaseline
// Orchestration: load → entity.setAsBaseline() → clear others → save
// =============================================================================
class SetBaseline {
    routes;
    constructor(routes) {
        this.routes = routes;
    }
    async execute(input) {
        if (!input.routeId?.trim()) {
            return (0, exports.err)((0, exports.validation)("routeId", "routeId is required"));
        }
        const existing = await this.routes.findById(input.routeId);
        if (!existing)
            return (0, exports.err)((0, exports.notFound)("Route", input.routeId));
        // Domain entity produces the new immutable instance
        const updated = existing.setAsBaseline();
        // Clear any existing baseline for this year (except the one we're setting)
        await this.routes.clearBaselineForYear(updated.year, updated.routeId);
        await this.routes.save(updated);
        return (0, exports.ok)({ route: routeToDTO(updated) });
    }
}
exports.SetBaseline = SetBaseline;
// =============================================================================
// SECTION 9 — Use-case: GetComparison
// Orchestration: load baseline → load all routes → entity.compareAgainst()
// =============================================================================
class GetComparison {
    routes;
    constructor(routes) {
        this.routes = routes;
    }
    async execute(input) {
        if (!input.year)
            return (0, exports.err)((0, exports.validation)("year", "year is required"));
        const baseline = await this.routes.findBaseline(input.year);
        if (!baseline) {
            return (0, exports.err)((0, exports.domainRule)(`No baseline route set for year ${input.year}`));
        }
        const all = await this.routes.findAll({ year: input.year });
        // Domain entity does the comparison math — use-case just iterates
        const comparisons = all
            .filter(r => r.routeId !== baseline.routeId)
            .map(r => r.compareAgainst(baseline));
        return (0, exports.ok)({ comparisons });
    }
}
exports.GetComparison = GetComparison;
// =============================================================================
// SECTION 10 — Use-case: ComputeComplianceBalance
// Orchestration: load route → entity constructs CB → snapshot → persist
// Formula: (Target - Actual) × Energy lives in ComplianceBalance constructor
// =============================================================================
class ComputeComplianceBalance {
    routes;
    compliance;
    constructor(routes, compliance) {
        this.routes = routes;
        this.compliance = compliance;
    }
    async execute(input) {
        if (!input.shipId?.trim())
            return (0, exports.err)((0, exports.validation)("shipId", "shipId is required"));
        if (!input.routeId?.trim())
            return (0, exports.err)((0, exports.validation)("routeId", "routeId is required"));
        if (!input.year)
            return (0, exports.err)((0, exports.validation)("year", "year is required"));
        const route = await this.routes.findById(input.routeId);
        if (!route)
            return (0, exports.err)((0, exports.notFound)("Route", input.routeId));
        if (route.year !== input.year) {
            return (0, exports.err)((0, exports.validation)("year", `Route ${input.routeId} belongs to year ${route.year}, not ${input.year}`));
        }
        // Domain entity computes CB — no arithmetic in this use-case
        const cbResult = guard(() => domain_1.ComplianceBalance.forRoute(input.shipId, input.year, route));
        if (!cbResult.ok)
            return cbResult;
        const cb = cbResult.value;
        await this.compliance.save(cb.toSnapshot());
        return (0, exports.ok)({
            shipId: cb.shipId,
            year: cb.year,
            routeId: route.routeId,
            cbGco2eq: cb.cb,
            isSurplus: cb.isSurplus(),
            energyInScopeMJ: route.energyInScope(),
            ghgIntensityActual: route.ghgIntensity,
            ghgIntensityTarget: 89.3368, // exposed for UI display only; formula uses domain constant
        });
    }
}
exports.ComputeComplianceBalance = ComputeComplianceBalance;
// =============================================================================
// SECTION 11 — Use-case: GetAdjustedCB
// Orchestration: load snapshot → return (banking already applied upstream)
// =============================================================================
class GetAdjustedCB {
    compliance;
    constructor(compliance) {
        this.compliance = compliance;
    }
    async execute(input) {
        if (!input.shipId?.trim())
            return (0, exports.err)((0, exports.validation)("shipId", "shipId is required"));
        if (!input.year)
            return (0, exports.err)((0, exports.validation)("year", "year is required"));
        const snapshot = await this.compliance.findByShipAndYear(input.shipId, input.year);
        if (!snapshot)
            return (0, exports.err)((0, exports.notFound)("ComplianceBalance", `${input.shipId}:${input.year}`));
        return (0, exports.ok)({
            shipId: snapshot.shipId,
            year: snapshot.year,
            cbGco2eq: snapshot.cbGco2eq,
            isSurplus: snapshot.isSurplus,
        });
    }
}
exports.GetAdjustedCB = GetAdjustedCB;
// =============================================================================
// SECTION 12 — Use-case: ListBankRecords
// =============================================================================
class ListBankRecords {
    bank;
    constructor(bank) {
        this.bank = bank;
    }
    async execute(input) {
        if (!input.shipId?.trim())
            return (0, exports.err)((0, exports.validation)("shipId", "shipId is required"));
        if (!input.year)
            return (0, exports.err)((0, exports.validation)("year", "year is required"));
        const entries = await this.bank.findOpenByShipAndYear(input.shipId, input.year);
        return (0, exports.ok)({ entries: entries.map(bankEntryToDTO) });
    }
}
exports.ListBankRecords = ListBankRecords;
// =============================================================================
// SECTION 13 — Use-case: BankSurplus (Article 20)
// Orchestration: load route → build CB → entity validates surplus → save
// Domain rule "only surplus can be banked" lives in BankEntry.bank()
// =============================================================================
class BankSurplus {
    routes;
    compliance;
    bank;
    ids;
    constructor(routes, compliance, bank, ids) {
        this.routes = routes;
        this.compliance = compliance;
        this.bank = bank;
        this.ids = ids;
    }
    async execute(input) {
        if (!input.shipId?.trim())
            return (0, exports.err)((0, exports.validation)("shipId", "shipId is required"));
        if (!input.routeId?.trim())
            return (0, exports.err)((0, exports.validation)("routeId", "routeId is required"));
        if (!input.year)
            return (0, exports.err)((0, exports.validation)("year", "year is required"));
        const route = await this.routes.findById(input.routeId);
        if (!route)
            return (0, exports.err)((0, exports.notFound)("Route", input.routeId));
        // Build CB — domain computes the formula
        const cbResult = guard(() => domain_1.ComplianceBalance.forRoute(input.shipId, input.year, route));
        if (!cbResult.ok)
            return cbResult;
        const cb = cbResult.value;
        // Idempotency: prevent double-banking for the same ship-year
        const existing = await this.bank.findOpenByShipAndYear(input.shipId, input.year);
        if (existing.length > 0) {
            return (0, exports.err)((0, exports.conflict)(`Ship ${input.shipId} already has an open bank entry for year ${input.year}`));
        }
        // Domain entity enforces "surplus only" — no if-statement here
        const entryResult = guard(() => domain_1.BankEntry.bank(this.ids.generate(), cb));
        if (!entryResult.ok)
            return entryResult;
        const entry = entryResult.value;
        await this.compliance.save(cb.toSnapshot());
        await this.bank.save(entry);
        return (0, exports.ok)({
            bankEntryId: entry.id,
            shipId: entry.shipId,
            year: entry.year,
            bankedAmountGco2eq: entry.amountGco2eq,
        });
    }
}
exports.BankSurplus = BankSurplus;
// =============================================================================
// SECTION 14 — Use-case: ApplyBankedCompliance (Article 20)
// Orchestration: load route → compute CB → check deficit → iterate entries
// Domain rules (deficit-only, over-apply guard) live in domain entities
// =============================================================================
class ApplyBankedCompliance {
    routes;
    compliance;
    bank;
    constructor(routes, compliance, bank) {
        this.routes = routes;
        this.compliance = compliance;
        this.bank = bank;
    }
    async execute(input) {
        if (!input.shipId?.trim())
            return (0, exports.err)((0, exports.validation)("shipId", "shipId is required"));
        if (!input.routeId?.trim())
            return (0, exports.err)((0, exports.validation)("routeId", "routeId is required"));
        if (!input.year)
            return (0, exports.err)((0, exports.validation)("year", "year is required"));
        if (!(input.amountToApply > 0)) {
            return (0, exports.err)((0, exports.validation)("amountToApply", "amountToApply must be > 0"));
        }
        const route = await this.routes.findById(input.routeId);
        if (!route)
            return (0, exports.err)((0, exports.notFound)("Route", input.routeId));
        const cbResult = guard(() => domain_1.ComplianceBalance.forRoute(input.shipId, input.year, route));
        if (!cbResult.ok)
            return cbResult;
        const cb = cbResult.value;
        // Domain entity validates "only deficit ships apply banked credits"
        const requested = Math.min(input.amountToApply, Math.abs(cb.cb));
        const applyCheckResult = guard(() => cb.applyBanked(requested));
        if (!applyCheckResult.ok)
            return applyCheckResult;
        // Check available balance via repository
        const totalAvailable = await this.bank.totalAvailableBalance(input.shipId, input.year);
        if (totalAvailable <= 0) {
            return (0, exports.err)((0, exports.domainRule)(`Ship ${input.shipId} has no banked balance for year ${input.year}`));
        }
        if (requested > totalAvailable + 1e-9) {
            return (0, exports.err)((0, exports.domainRule)(`Requested ${requested.toFixed(2)} gCO₂e exceeds available balance ` +
                `of ${totalAvailable.toFixed(2)} gCO₂e`));
        }
        // Drain open entries FIFO — entry.apply() enforces per-entry limits
        const openEntries = await this.bank.findOpenByShipAndYear(input.shipId, input.year);
        let remaining = requested;
        for (const entry of openEntries) {
            if (remaining <= 1e-9)
                break;
            const applyResult = guard(() => entry.apply(remaining));
            if (!applyResult.ok)
                return applyResult;
            remaining -= applyResult.value;
            await this.bank.save(entry);
        }
        const actualApplied = requested - Math.max(remaining, 0);
        // Domain entity produces the adjusted snapshot value object
        const adjustedResult = guard(() => cb.applyBanked(actualApplied));
        if (!adjustedResult.ok)
            return adjustedResult;
        const adjusted = adjustedResult.value;
        await this.compliance.save({ ...cb.toSnapshot(), cbGco2eq: adjusted.cbAfter });
        const newBalance = await this.bank.totalAvailableBalance(input.shipId, input.year);
        return (0, exports.ok)({
            shipId: input.shipId,
            year: input.year,
            cbBefore: adjusted.cbBefore,
            applied: adjusted.applied,
            cbAfter: adjusted.cbAfter,
            remainingBankBalance: newBalance,
        });
    }
}
exports.ApplyBankedCompliance = ApplyBankedCompliance;
// =============================================================================
// SECTION 15 — Use-case: CreatePool (Article 21)
// Orchestration: build adjusted CB per member → delegate to Pool.create()
// All three Article 21 invariants enforced inside Pool entity
// =============================================================================
class CreatePool {
    routes;
    compliance;
    bank;
    pools;
    ids;
    constructor(routes, compliance, bank, pools, ids) {
        this.routes = routes;
        this.compliance = compliance;
        this.bank = bank;
        this.pools = pools;
        this.ids = ids;
    }
    async execute(input) {
        if (!input.year)
            return (0, exports.err)((0, exports.validation)("year", "year is required"));
        if (!input.members || input.members.length < 2) {
            return (0, exports.err)((0, exports.validation)("members", "a pool requires at least 2 members"));
        }
        const uniqueShips = new Set(input.members.map(m => m.shipId));
        if (uniqueShips.size !== input.members.length) {
            return (0, exports.err)((0, exports.validation)("members", "duplicate shipId entries are not allowed"));
        }
        // --- Build PoolMemberInput for each member ---
        const memberInputs = [];
        const routeMap = new Map(); // shipId → routeId (for output DTO)
        for (const m of input.members) {
            if (!m.shipId?.trim())
                return (0, exports.err)((0, exports.validation)("shipId", `member shipId is required`));
            if (!m.routeId?.trim())
                return (0, exports.err)((0, exports.validation)("routeId", `member ${m.shipId} missing routeId`));
            const route = await this.routes.findById(m.routeId);
            if (!route)
                return (0, exports.err)((0, exports.notFound)("Route", m.routeId));
            if (route.year !== input.year) {
                return (0, exports.err)((0, exports.validation)("year", `Route ${m.routeId} belongs to year ${route.year}, not ${input.year}`));
            }
            // Compute raw CB via domain entity
            const cbResult = guard(() => domain_1.ComplianceBalance.forRoute(m.shipId, input.year, route));
            if (!cbResult.ok)
                return cbResult;
            const cb = cbResult.value;
            await this.compliance.save(cb.toSnapshot());
            // Resolve adjustedCb: raw CB + applicable bank balance
            const bankedBalance = await this.bank.totalAvailableBalance(m.shipId, input.year);
            const bankApplicable = cb.isDeficit()
                ? Math.min(bankedBalance, Math.abs(cb.cb))
                : 0;
            memberInputs.push({ shipId: m.shipId, adjustedCb: cb.cb + bankApplicable });
            routeMap.set(m.shipId, m.routeId);
        }
        // Delegate all Article 21 invariants + greedy allocation to Pool entity
        const poolResult = guard(() => domain_1.Pool.create(this.ids.generate(), input.year, memberInputs));
        if (!poolResult.ok)
            return poolResult;
        const pool = poolResult.value;
        await this.pools.save(pool);
        return (0, exports.ok)({
            poolId: pool.id,
            year: pool.year,
            poolSumGco2eq: pool.poolSum(),
            isBalanced: pool.isBalanced(),
            members: pool.members.map((r) => ({
                shipId: r.shipId,
                routeId: routeMap.get(r.shipId),
                cbBefore: r.cbBefore,
                cbAfter: r.cbAfter,
                transfer: r.transfer,
            })),
        });
    }
}
exports.CreatePool = CreatePool;
//# sourceMappingURL=application.js.map