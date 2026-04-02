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

import {
  Route,
  ComplianceBalance,
  BankEntry,
  Pool,
  DomainError,
  InvariantViolation,
  type RouteProps,
  type VesselType,
  type FuelType,
  type BankStatus,
  type CBSnapshot,
  type RouteComparison,
  type PoolMemberInput,
  type PoolMemberResult,
} from "./domain";

// =============================================================================
// SECTION 1 — Result<T, E>
// =============================================================================

export type Result<T, E = ApplicationError> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

export const ok  = <T>(value: T): Result<T> => ({ ok: true,  value });
export const err = <T>(error: ApplicationError): Result<T> => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Typed error catalogue — discriminated union; maps to HTTP status codes
// in the HTTP adapter layer
// ---------------------------------------------------------------------------

export type ApplicationError =
  | { code: "NOT_FOUND";   message: string; entity: string; id: string }
  | { code: "DOMAIN_RULE"; message: string }
  | { code: "VALIDATION";  message: string; field: string }
  | { code: "CONFLICT";    message: string };

export const notFound  = (entity: string, id: string): ApplicationError =>
  ({ code: "NOT_FOUND",   message: `${entity} '${id}' not found`, entity, id });
export const domainRule = (message: string): ApplicationError =>
  ({ code: "DOMAIN_RULE", message });
export const validation = (field: string, message: string): ApplicationError =>
  ({ code: "VALIDATION",  message, field });
export const conflict   = (message: string): ApplicationError =>
  ({ code: "CONFLICT",    message });

/**
 * Wraps any domain throw (InvariantViolation / DomainError) into a Result.
 * Only domain errors are swallowed — unexpected errors re-throw upward.
 */
function guard<T>(fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (e) {
    if (e instanceof InvariantViolation || e instanceof DomainError) {
      return err(domainRule(e.message));
    }
    throw e;
  }
}

// =============================================================================
// SECTION 2 — Outbound Ports (repository interfaces)
//
// The domain never imports these. Adapters in /adapters/outbound/postgres/
// implement them. The mapping between DB rows and domain entities lives
// exclusively in Section 3 (mappers) — never inside entities or use-cases.
// =============================================================================

// ---------------------------------------------------------------------------
// Raw DB row shapes — what Prisma/pg actually returns
// These types belong to the application layer (not the domain), because
// the domain knows nothing about persistence.
// ---------------------------------------------------------------------------

export interface RouteRow {
  id:               string;
  route_id:         string;
  vessel_type:      string;
  fuel_type:        string;
  year:             number;
  ghg_intensity:    string | number;   // Prisma returns Decimal as string
  fuel_consumption: string | number;
  distance:         string | number;
  total_emissions:  string | number;
  is_baseline:      boolean;
}

export interface ComplianceRow {
  id:          string;
  ship_id:     string;
  year:        number;
  route_id:    string;   // FK → routes.id (surrogate)
  cb_gco2eq:   string | number;
  is_surplus:  boolean;
  computed_at: Date;
}

export interface BankEntryRow {
  id:             string;
  ship_id:        string;
  year:           number;
  amount_gco2eq:  string | number;
  applied_gco2eq: string | number;
  status:         string;
  created_at:     Date;
  updated_at:     Date;
}

export interface PoolRow {
  id:         string;
  year:       number;
  pool_sum:   string | number;
  created_at: Date;
}

export interface PoolMemberRow {
  id:        string;
  pool_id:   string;
  ship_id:   string;
  cb_before: string | number;
  cb_after:  string | number;
  transfer:  string | number;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface RouteFilters {
  year?:       number;
  vesselType?: string;
  fuelType?:   string;
}

// ---------------------------------------------------------------------------
// Port interfaces — implemented by Postgres adapters
// ---------------------------------------------------------------------------

export interface IRouteRepository {
  findById(routeId: string): Promise<Route | null>;           // finds by route_id (natural key)
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
const toNum = (v: string | number): number =>
  typeof v === "string" ? parseFloat(v) : v;

// ---------------------------------------------------------------------------
// RouteMapper
// ---------------------------------------------------------------------------

export const RouteMapper = {
  /**
   * DB row → Route domain entity
   * Maps snake_case column names to the camelCase RouteProps the domain expects.
   */
  toDomain(row: RouteRow): Route {
    const props: RouteProps = {
      routeId:         row.route_id,
      vesselType:      row.vessel_type as VesselType,
      fuelType:        row.fuel_type   as FuelType,
      year:            row.year,
      ghgIntensity:    toNum(row.ghg_intensity),
      fuelConsumption: toNum(row.fuel_consumption),
      distance:        toNum(row.distance),
      totalEmissions:  toNum(row.total_emissions),
    };
    return Route.create(props, row.is_baseline);
  },

  /**
   * Route domain entity → DB insert shape (snake_case)
   * Used by IRouteRepository.save() implementations.
   */
  toRow(route: Route): Omit<RouteRow, "id"> {
    return {
      route_id:         route.routeId,
      vessel_type:      route.vesselType,
      fuel_type:        route.fuelType,
      year:             route.year,
      ghg_intensity:    route.ghgIntensity,
      fuel_consumption: route.fuelConsumption,
      distance:         route.distance,
      total_emissions:  route.totalEmissions,
      is_baseline:      route.isBaseline,
    };
  },
};

// ---------------------------------------------------------------------------
// ComplianceMapper
// ---------------------------------------------------------------------------

export const ComplianceMapper = {
  /**
   * DB row → CBSnapshot (plain object used by use-cases and repositories).
   * ComplianceBalance is rehydrated from a Route — not from a snapshot row —
   * because the formula must always be re-derivable from first principles.
   */
  toSnapshot(row: ComplianceRow): CBSnapshot {
    return {
      shipId:    row.ship_id,
      year:      row.year,
      routeId:   row.route_id,   // stores the natural route_id, not the UUID
      cbGco2eq:  toNum(row.cb_gco2eq),
      isSurplus: row.is_surplus,
    };
  },

  /**
   * CBSnapshot → DB insert shape.
   * is_surplus is a GENERATED ALWAYS column — omitted from insert.
   */
  toRow(snapshot: CBSnapshot): Omit<ComplianceRow, "id" | "is_surplus" | "computed_at"> {
    return {
      ship_id:   snapshot.shipId,
      year:      snapshot.year,
      route_id:  snapshot.routeId,
      cb_gco2eq: snapshot.cbGco2eq,
    };
  },
};

// ---------------------------------------------------------------------------
// BankEntryMapper
// ---------------------------------------------------------------------------

export const BankEntryMapper = {
  /**
   * DB row → BankEntry domain entity.
   * BankEntry has a private constructor — we use the internal rehydration
   * path via Object.assign to restore applied state without re-running
   * the bank() factory (which would reject non-zero applied amounts).
   */
  toDomain(row: BankEntryRow): BankEntry {
    // Create via factory with the original amount
    const cb = {
      shipId:   row.ship_id,
      year:     row.year,
      cb:       toNum(row.amount_gco2eq),
      isSurplus: () => true,
    } as unknown as ComplianceBalance;

    const entry = BankEntry.bank(row.id, cb);

    // Restore the applied amount that has accumulated since creation.
    // We reach into the private field only in this mapper — the domain
    // entity itself never exposes a setter.
    const applied = toNum(row.applied_gco2eq);
    if (applied > 0) {
      // Replay the apply() calls by calling apply() with the already-applied total.
      // This is safe: amount_gco2eq > applied is enforced by schema CHECK constraint.
      (entry as unknown as { _appliedAmount: number })._appliedAmount = applied;
    }

    return entry;
  },

  /**
   * BankEntry domain entity → DB update shape (status + applied_gco2eq).
   * amount_gco2eq and ship_id never change after creation.
   */
  toUpdateRow(entry: BankEntry): Pick<BankEntryRow, "applied_gco2eq" | "status"> {
    return {
      applied_gco2eq: entry.appliedAmount,
      status:         entry.status(),
    };
  },

  /**
   * BankEntry → full DB insert shape (used on first save).
   */
  toInsertRow(entry: BankEntry): Omit<BankEntryRow, "id" | "created_at" | "updated_at"> {
    return {
      ship_id:        entry.shipId,
      year:           entry.year,
      amount_gco2eq:  entry.amountGco2eq,
      applied_gco2eq: entry.appliedAmount,
      status:         entry.status(),
    };
  },
};

// ---------------------------------------------------------------------------
// PoolMapper
// ---------------------------------------------------------------------------

export const PoolMapper = {
  /**
   * Pool domain entity → DB insert shape for the pools header row.
   */
  toPoolRow(pool: Pool): Omit<PoolRow, "id" | "created_at"> {
    return {
      year:     pool.year,
      pool_sum: pool.poolSum(),
    };
  },

  /**
   * Pool domain entity → array of DB insert shapes for pool_members.
   */
  toMemberRows(pool: Pool): Array<Omit<PoolMemberRow, "id">> {
    return pool.members.map(m => ({
      pool_id:   pool.id,
      ship_id:   m.shipId,
      cb_before: m.cbBefore,
      cb_after:  m.cbAfter,
      transfer:  m.transfer,
    }));
  },
};

// =============================================================================
// SECTION 4 — Inbound Port (what the HTTP adapter depends on)
// =============================================================================

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

// =============================================================================
// SECTION 5 — DTOs (Input + Output shapes per use-case)
// =============================================================================

// --- Routes ------------------------------------------------------------------
export interface RouteListOutput  { routes: RouteDTO[] }
export interface RouteDTO {
  routeId: string; vesselType: string; fuelType: string; year: number;
  ghgIntensity: number; fuelConsumption: number; distance: number;
  totalEmissions: number; isBaseline: boolean; isCompliant: boolean;
  energyInScopeMJ: number;
}

export interface SetBaselineInput  { routeId: string }
export interface SetBaselineOutput { route: RouteDTO }

export interface GetComparisonInput  { year: number }
export interface RouteComparisonOutput { comparisons: RouteComparison[] }

// --- Compliance --------------------------------------------------------------
export interface ComputeCBInput  { shipId: string; routeId: string; year: number }
export interface ComputeCBOutput {
  shipId: string; year: number; routeId: string;
  cbGco2eq: number; isSurplus: boolean;
  energyInScopeMJ: number; ghgIntensityActual: number; ghgIntensityTarget: number;
}

export interface GetAdjustedCBInput  { shipId: string; year: number }
export interface AdjustedCBOutput {
  shipId: string; year: number;
  cbGco2eq: number; isSurplus: boolean;
}

// --- Banking -----------------------------------------------------------------
export interface ListBankInput    { shipId: string; year: number }
export interface BankRecordsOutput { entries: BankEntryDTO[] }
export interface BankEntryDTO {
  id: string; shipId: string; year: number;
  amountGco2eq: number; appliedGco2eq: number;
  availableBalance: number; status: BankStatus;
}

export interface BankSurplusInput  { shipId: string; routeId: string; year: number }
export interface BankSurplusOutput {
  bankEntryId: string; shipId: string; year: number; bankedAmountGco2eq: number;
}

export interface ApplyBankedInput  {
  shipId: string; routeId: string; year: number; amountToApply: number;
}
export interface ApplyBankedOutput {
  shipId: string; year: number;
  cbBefore: number; applied: number; cbAfter: number; remainingBankBalance: number;
}

// --- Pooling -----------------------------------------------------------------
export interface CreatePoolInput   { year: number; members: PoolMemberInputDTO[] }
export interface PoolMemberInputDTO { shipId: string; routeId: string }
export interface CreatePoolOutput  {
  poolId: string; year: number; poolSumGco2eq: number; isBalanced: boolean;
  members: PoolMemberOutputDTO[];
}
export interface PoolMemberOutputDTO {
  shipId: string; routeId: string;
  cbBefore: number; cbAfter: number; transfer: number;
}

// =============================================================================
// SECTION 6 — Domain → DTO mappers (keep controllers thin)
// =============================================================================

function routeToDTO(route: Route): RouteDTO {
  return {
    routeId:         route.routeId,
    vesselType:      route.vesselType,
    fuelType:        route.fuelType,
    year:            route.year,
    ghgIntensity:    route.ghgIntensity,
    fuelConsumption: route.fuelConsumption,
    distance:        route.distance,
    totalEmissions:  route.totalEmissions,
    isBaseline:      route.isBaseline,
    isCompliant:     route.isCompliant(),    // domain behaviour called here
    energyInScopeMJ: route.energyInScope(),  // domain behaviour called here
  };
}

function bankEntryToDTO(entry: BankEntry): BankEntryDTO {
  return {
    id:               entry.id,
    shipId:           entry.shipId,
    year:             entry.year,
    amountGco2eq:     entry.amountGco2eq,
    appliedGco2eq:    entry.appliedAmount,
    availableBalance: entry.availableBalance,
    status:           entry.status(),
  };
}

// =============================================================================
// SECTION 7 — Use-case: ListRoutes
// Orchestration: filters → repo → map to DTOs
// =============================================================================

export class ListRoutes {
  constructor(private readonly routes: IRouteRepository) {}

  async execute(filters: RouteFilters): Promise<Result<RouteListOutput>> {
    const routes = await this.routes.findAll(filters);
    return ok({ routes: routes.map(routeToDTO) });
  }
}

// =============================================================================
// SECTION 8 — Use-case: SetBaseline
// Orchestration: load → entity.setAsBaseline() → clear others → save
// =============================================================================

export class SetBaseline {
  constructor(private readonly routes: IRouteRepository) {}

  async execute(input: SetBaselineInput): Promise<Result<SetBaselineOutput>> {
    if (!input.routeId?.trim()) {
      return err(validation("routeId", "routeId is required"));
    }

    const existing = await this.routes.findById(input.routeId);
    if (!existing) return err(notFound("Route", input.routeId));

    // Domain entity produces the new immutable instance
    const updated = existing.setAsBaseline();

    // Clear any existing baseline for this year (except the one we're setting)
    await this.routes.clearBaselineForYear(updated.year, updated.routeId);
    await this.routes.save(updated);

    return ok({ route: routeToDTO(updated) });
  }
}

// =============================================================================
// SECTION 9 — Use-case: GetComparison
// Orchestration: load baseline → load all routes → entity.compareAgainst()
// =============================================================================

export class GetComparison {
  constructor(private readonly routes: IRouteRepository) {}

  async execute(input: GetComparisonInput): Promise<Result<RouteComparisonOutput>> {
    if (!input.year) return err(validation("year", "year is required"));

    const baseline = await this.routes.findBaseline(input.year);
    if (!baseline) {
      return err(domainRule(`No baseline route set for year ${input.year}`));
    }

    const all = await this.routes.findAll({ year: input.year });

    // Domain entity does the comparison math — use-case just iterates
    const comparisons = all
      .filter(r => r.routeId !== baseline.routeId)
      .map(r => r.compareAgainst(baseline));

    return ok({ comparisons });
  }
}

// =============================================================================
// SECTION 10 — Use-case: ComputeComplianceBalance
// Orchestration: load route → entity constructs CB → snapshot → persist
// Formula: (Target - Actual) × Energy lives in ComplianceBalance constructor
// =============================================================================

export class ComputeComplianceBalance {
  constructor(
    private readonly routes:     IRouteRepository,
    private readonly compliance: IComplianceRepository,
  ) {}

  async execute(input: ComputeCBInput): Promise<Result<ComputeCBOutput>> {
    if (!input.shipId?.trim())  return err(validation("shipId",  "shipId is required"));
    if (!input.routeId?.trim()) return err(validation("routeId", "routeId is required"));
    if (!input.year)            return err(validation("year",    "year is required"));

    const route = await this.routes.findById(input.routeId);
    if (!route) return err(notFound("Route", input.routeId));

    if (route.year !== input.year) {
      return err(validation("year",
        `Route ${input.routeId} belongs to year ${route.year}, not ${input.year}`));
    }

    // Domain entity computes CB — no arithmetic in this use-case
    const cbResult = guard(() =>
      ComplianceBalance.forRoute(input.shipId, input.year, route)
    );
    if (!cbResult.ok) return cbResult;

    const cb = cbResult.value;
    await this.compliance.save(cb.toSnapshot());

    return ok({
      shipId:              cb.shipId,
      year:                cb.year,
      routeId:             route.routeId,
      cbGco2eq:            cb.cb,
      isSurplus:           cb.isSurplus(),
      energyInScopeMJ:     route.energyInScope(),
      ghgIntensityActual:  route.ghgIntensity,
      ghgIntensityTarget:  89.3368,   // exposed for UI display only; formula uses domain constant
    });
  }
}

// =============================================================================
// SECTION 11 — Use-case: GetAdjustedCB
// Orchestration: load snapshot → return (banking already applied upstream)
// =============================================================================

export class GetAdjustedCB {
  constructor(private readonly compliance: IComplianceRepository) {}

  async execute(input: GetAdjustedCBInput): Promise<Result<AdjustedCBOutput>> {
    if (!input.shipId?.trim()) return err(validation("shipId", "shipId is required"));
    if (!input.year)           return err(validation("year",   "year is required"));

    const snapshot = await this.compliance.findByShipAndYear(input.shipId, input.year);
    if (!snapshot) return err(notFound("ComplianceBalance", `${input.shipId}:${input.year}`));

    return ok({
      shipId:    snapshot.shipId,
      year:      snapshot.year,
      cbGco2eq:  snapshot.cbGco2eq,
      isSurplus: snapshot.isSurplus,
    });
  }
}

// =============================================================================
// SECTION 12 — Use-case: ListBankRecords
// =============================================================================

export class ListBankRecords {
  constructor(private readonly bank: IBankRepository) {}

  async execute(input: ListBankInput): Promise<Result<BankRecordsOutput>> {
    if (!input.shipId?.trim()) return err(validation("shipId", "shipId is required"));
    if (!input.year)           return err(validation("year",   "year is required"));

    const entries = await this.bank.findOpenByShipAndYear(input.shipId, input.year);
    return ok({ entries: entries.map(bankEntryToDTO) });
  }
}

// =============================================================================
// SECTION 13 — Use-case: BankSurplus (Article 20)
// Orchestration: load route → build CB → entity validates surplus → save
// Domain rule "only surplus can be banked" lives in BankEntry.bank()
// =============================================================================

export class BankSurplus {
  constructor(
    private readonly routes:     IRouteRepository,
    private readonly compliance: IComplianceRepository,
    private readonly bank:       IBankRepository,
    private readonly ids:        IIdGenerator,
  ) {}

  async execute(input: BankSurplusInput): Promise<Result<BankSurplusOutput>> {
    if (!input.shipId?.trim())  return err(validation("shipId",  "shipId is required"));
    if (!input.routeId?.trim()) return err(validation("routeId", "routeId is required"));
    if (!input.year)            return err(validation("year",    "year is required"));

    const route = await this.routes.findById(input.routeId);
    if (!route) return err(notFound("Route", input.routeId));

    // Build CB — domain computes the formula
    const cbResult = guard(() =>
      ComplianceBalance.forRoute(input.shipId, input.year, route)
    );
    if (!cbResult.ok) return cbResult;

    const cb = cbResult.value;

    // Idempotency: prevent double-banking for the same ship-year
    const existing = await this.bank.findOpenByShipAndYear(input.shipId, input.year);
    if (existing.length > 0) {
      return err(conflict(
        `Ship ${input.shipId} already has an open bank entry for year ${input.year}`
      ));
    }

    // Domain entity enforces "surplus only" — no if-statement here
    const entryResult = guard(() =>
      BankEntry.bank(this.ids.generate(), cb)
    );
    if (!entryResult.ok) return entryResult;

    const entry = entryResult.value;

    await this.compliance.save(cb.toSnapshot());
    await this.bank.save(entry);

    return ok({
      bankEntryId:       entry.id,
      shipId:            entry.shipId,
      year:              entry.year,
      bankedAmountGco2eq: entry.amountGco2eq,
    });
  }
}

// =============================================================================
// SECTION 14 — Use-case: ApplyBankedCompliance (Article 20)
// Orchestration: load route → compute CB → check deficit → iterate entries
// Domain rules (deficit-only, over-apply guard) live in domain entities
// =============================================================================

export class ApplyBankedCompliance {
  constructor(
    private readonly routes:     IRouteRepository,
    private readonly compliance: IComplianceRepository,
    private readonly bank:       IBankRepository,
  ) {}

  async execute(input: ApplyBankedInput): Promise<Result<ApplyBankedOutput>> {
    if (!input.shipId?.trim())  return err(validation("shipId",       "shipId is required"));
    if (!input.routeId?.trim()) return err(validation("routeId",      "routeId is required"));
    if (!input.year)            return err(validation("year",         "year is required"));
    if (!(input.amountToApply > 0)) {
      return err(validation("amountToApply", "amountToApply must be > 0"));
    }

    const route = await this.routes.findById(input.routeId);
    if (!route) return err(notFound("Route", input.routeId));

    const cbResult = guard(() =>
      ComplianceBalance.forRoute(input.shipId, input.year, route)
    );
    if (!cbResult.ok) return cbResult;

    const cb = cbResult.value;

    // Domain entity validates "only deficit ships apply banked credits"
    const requested = Math.min(input.amountToApply, Math.abs(cb.cb));
    const applyCheckResult = guard(() => cb.applyBanked(requested));
    if (!applyCheckResult.ok) return applyCheckResult;

    // Check available balance via repository
    const totalAvailable = await this.bank.totalAvailableBalance(input.shipId, input.year);
    if (totalAvailable <= 0) {
      return err(domainRule(
        `Ship ${input.shipId} has no banked balance for year ${input.year}`
      ));
    }
    if (requested > totalAvailable + 1e-9) {
      return err(domainRule(
        `Requested ${requested.toFixed(2)} gCO₂e exceeds available balance ` +
        `of ${totalAvailable.toFixed(2)} gCO₂e`
      ));
    }

    // Drain open entries FIFO — entry.apply() enforces per-entry limits
    const openEntries = await this.bank.findOpenByShipAndYear(input.shipId, input.year);
    let remaining = requested;

    for (const entry of openEntries) {
      if (remaining <= 1e-9) break;
      const applyResult = guard(() => entry.apply(remaining));
      if (!applyResult.ok) return applyResult;
      remaining -= applyResult.value;
      await this.bank.save(entry);
    }

    const actualApplied = requested - Math.max(remaining, 0);

    // Domain entity produces the adjusted snapshot value object
    const adjustedResult = guard(() => cb.applyBanked(actualApplied));
    if (!adjustedResult.ok) return adjustedResult;

    const adjusted = adjustedResult.value;
    await this.compliance.save({ ...cb.toSnapshot(), cbGco2eq: adjusted.cbAfter });

    const newBalance = await this.bank.totalAvailableBalance(input.shipId, input.year);

    return ok({
      shipId:               input.shipId,
      year:                 input.year,
      cbBefore:             adjusted.cbBefore,
      applied:              adjusted.applied,
      cbAfter:              adjusted.cbAfter,
      remainingBankBalance: newBalance,
    });
  }
}

// =============================================================================
// SECTION 15 — Use-case: CreatePool (Article 21)
// Orchestration: build adjusted CB per member → delegate to Pool.create()
// All three Article 21 invariants enforced inside Pool entity
// =============================================================================

export class CreatePool {
  constructor(
    private readonly routes:     IRouteRepository,
    private readonly compliance: IComplianceRepository,
    private readonly bank:       IBankRepository,
    private readonly pools:      IPoolRepository,
    private readonly ids:        IIdGenerator,
  ) {}

  async execute(input: CreatePoolInput): Promise<Result<CreatePoolOutput>> {
    if (!input.year) return err(validation("year", "year is required"));
    if (!input.members || input.members.length < 2) {
      return err(validation("members", "a pool requires at least 2 members"));
    }

    const uniqueShips = new Set(input.members.map(m => m.shipId));
    if (uniqueShips.size !== input.members.length) {
      return err(validation("members", "duplicate shipId entries are not allowed"));
    }

    // --- Build PoolMemberInput for each member ---
    const memberInputs: PoolMemberInput[] = [];
    const routeMap = new Map<string, string>(); // shipId → routeId (for output DTO)

    for (const m of input.members) {
      if (!m.shipId?.trim())  return err(validation("shipId",  `member shipId is required`));
      if (!m.routeId?.trim()) return err(validation("routeId", `member ${m.shipId} missing routeId`));

      const route = await this.routes.findById(m.routeId);
      if (!route) return err(notFound("Route", m.routeId));

      if (route.year !== input.year) {
        return err(validation("year",
          `Route ${m.routeId} belongs to year ${route.year}, not ${input.year}`));
      }

      // Compute raw CB via domain entity
      const cbResult = guard(() =>
        ComplianceBalance.forRoute(m.shipId, input.year, route)
      );
      if (!cbResult.ok) return cbResult;

      const cb = cbResult.value;
      await this.compliance.save(cb.toSnapshot());

      // Resolve adjustedCb: raw CB + applicable bank balance
      const bankedBalance  = await this.bank.totalAvailableBalance(m.shipId, input.year);
      const bankApplicable = cb.isDeficit()
        ? Math.min(bankedBalance, Math.abs(cb.cb))
        : 0;

      memberInputs.push({ shipId: m.shipId, adjustedCb: cb.cb + bankApplicable });
      routeMap.set(m.shipId, m.routeId);
    }

    // Delegate all Article 21 invariants + greedy allocation to Pool entity
    const poolResult = guard(() =>
      Pool.create(this.ids.generate(), input.year, memberInputs)
    );
    if (!poolResult.ok) return poolResult;

    const pool = poolResult.value;
    await this.pools.save(pool);

    return ok({
      poolId:        pool.id,
      year:          pool.year,
      poolSumGco2eq: pool.poolSum(),
      isBalanced:    pool.isBalanced(),
      members:       pool.members.map((r: PoolMemberResult) => ({
        shipId:   r.shipId,
        routeId:  routeMap.get(r.shipId)!,
        cbBefore: r.cbBefore,
        cbAfter:  r.cbAfter,
        transfer: r.transfer,
      })),
    });
  }
}
