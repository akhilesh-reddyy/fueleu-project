// =============================================================================
// FuelEU Maritime — Frontend Application Types
// These interfaces mirror the backend application layer DTOs so that
// API clients and tab components share the same type contract.
// =============================================================================

export type VesselType = "Container" | "BulkCarrier" | "Tanker" | "RoRo" | "Cruise" | "Ferry";
export type FuelType   = "HFO" | "LNG" | "MGO" | "VLSFO" | "Methanol" | "Ammonia" | "Hydrogen";
export type BankStatus = "banked" | "partially_applied" | "fully_applied";

// ─── Routes ───────────────────────────────────────────────────────────────────

export interface RouteFilters {
  year?:       number;
  vesselType?: string;
  fuelType?:   string;
}

export interface RouteDTO {
  routeId:         string;
  vesselType:      VesselType;
  fuelType:        FuelType;
  year:            number;
  ghgIntensity:    number;
  fuelConsumption: number;
  distance:        number;
  totalEmissions:  number;
  isBaseline:      boolean;
  isCompliant:     boolean;
  energyInScopeMJ: number;
}

export interface RouteListOutput    { routes: RouteDTO[] }
export interface SetBaselineOutput  { route: RouteDTO }
export interface RouteComparisonOutput {
  comparisons: Array<{
    baselineRouteId:     string;
    comparisonRouteId:   string;
    baselineIntensity:   number;
    comparisonIntensity: number;
    percentDiff:         number;
    compliant:           boolean;
  }>;
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export interface ComputeCBOutput {
  shipId:             string;
  year:               number;
  routeId:            string;
  cbGco2eq:           number;
  isSurplus:          boolean;
  energyInScopeMJ:    number;
  ghgIntensityActual: number;
  ghgIntensityTarget: number;
}

export interface AdjustedCBOutput {
  shipId:    string;
  year:      number;
  cbGco2eq:  number;
  isSurplus: boolean;
}

// ─── Banking ──────────────────────────────────────────────────────────────────

export interface BankEntryDTO {
  id:               string;
  shipId:           string;
  year:             number;
  amountGco2eq:     number;
  appliedGco2eq:    number;
  availableBalance: number;
  status:           BankStatus;
}
export interface BankRecordsOutput  { entries: BankEntryDTO[] }
export interface BankSurplusOutput  { bankEntryId: string; shipId: string; year: number; bankedAmountGco2eq: number }
export interface ApplyBankedOutput  { shipId: string; year: number; cbBefore: number; applied: number; cbAfter: number; remainingBankBalance: number }

// ─── Pooling ──────────────────────────────────────────────────────────────────

export interface PoolMemberInputDTO { shipId: string; routeId: string }
export interface CreatePoolInput    { year: number; members: PoolMemberInputDTO[] }
export interface PoolMemberOutputDTO { shipId: string; routeId: string; cbBefore: number; cbAfter: number; transfer: number }
export interface CreatePoolOutput   { poolId: string; year: number; poolSumGco2eq: number; isBalanced: boolean; members: PoolMemberOutputDTO[] }
