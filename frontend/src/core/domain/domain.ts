// =============================================================================
// FuelEU Maritime — Frontend Domain Constants
// Mirrors the constants from the backend domain layer.
// The frontend uses these for in-browser CB calculation (preview only);
// authoritative calculations always happen on the backend.
// =============================================================================

export const FUEL_EU = {
  /** gCO₂e/MJ — 2% below the 91.16 reference value (Annex IV) */
  TARGET_GHG_INTENSITY: 89.3368,
  /** MJ per metric tonne — lower heating value for typical marine fuels */
  LHV_MJ_PER_TONNE: 41_000,
} as const;

export type VesselType = "Container" | "BulkCarrier" | "Tanker" | "RoRo" | "Cruise" | "Ferry";
export type FuelType   = "HFO" | "LNG" | "MGO" | "VLSFO" | "Methanol" | "Ammonia" | "Hydrogen";
