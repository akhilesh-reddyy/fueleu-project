import { useState, useMemo, useCallback } from "react";
import { FUEL_EU }                         from "@/core/domain/domain";
import type { RouteDTO }                   from "@/core/application/application";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoolMember {
  shipId:      string;
  routeId:     string;
  vesselType:  string;
  fuelType:    string;
  cbBefore:    number;   // gCO₂e, before pool allocation
  energyMJ:   number;
  ghgIntensity: number;
  isCompliant: boolean;
}

export interface AllocationResult {
  shipId:   string;
  cbBefore: number;
  cbAfter:  number;
  transfer: number;   // positive = received; negative = donated
}

export type ValidationError =
  | "TOO_FEW_MEMBERS"      // < 2 ships
  | "COLLECTIVE_DEFICIT"   // ∑ CB < 0
  | "DUPLICATE_SHIP"       // same shipId twice
  | "YEAR_MISMATCH";       // routes from different years

export interface PoolValidation {
  isValid:    boolean;
  errors:     ValidationError[];
  poolSum:    number;   // ∑ cbBefore across all members
  surplusCount: number;
  deficitCount: number;
}

export interface UsePoolingReturn {
  /** All available routes to pick from */
  availableRoutes:  RouteDTO[];
  /** Currently selected pool members */
  members:          PoolMember[];
  /** Live validation state */
  validation:       PoolValidation;
  /** Allocation results — null until createPool() is called */
  allocationResult: AllocationResult[] | null;
  /** True after createPool() has been called */
  isCreated:        boolean;

  // Actions
  addMember:    (route: RouteDTO) => void;
  removeMember: (shipId: string) => void;
  createPool:   () => void;
  reset:        () => void;
}

// ─── CB formula (delegates to domain constants) ───────────────────────────────

function computeCB(route: RouteDTO): number {
  const energy = route.fuelConsumption * FUEL_EU.LHV_MJ_PER_TONNE;
  return (FUEL_EU.TARGET_GHG_INTENSITY - route.ghgIntensity) * energy;
}

function routeToMember(route: RouteDTO): PoolMember {
  const energy = route.fuelConsumption * FUEL_EU.LHV_MJ_PER_TONNE;
  return {
    shipId:      route.routeId,
    routeId:     route.routeId,
    vesselType:  route.vesselType,
    fuelType:    route.fuelType,
    cbBefore:    computeCB(route),
    energyMJ:    energy,
    ghgIntensity: route.ghgIntensity,
    isCompliant:  route.ghgIntensity <= FUEL_EU.TARGET_GHG_INTENSITY,
  };
}

// ─── Greedy allocation (mirrors Pool domain entity) ───────────────────────────

function greedyAllocate(members: PoolMember[]): AllocationResult[] {
  const working = members
    .map(m => ({ shipId: m.shipId, cbBefore: m.cbBefore, cbAfter: m.cbBefore }))
    .sort((a, b) => b.cbAfter - a.cbAfter);   // descending: biggest surplus first

  for (let i = 0; i < working.length; i++) {
    const donor = working[i];
    if (donor.cbAfter <= 1e-9) break;

    for (let j = working.length - 1; j > i; j--) {
      const recipient = working[j];
      if (recipient.cbAfter >= -1e-9) continue;

      const transfer = Math.min(Math.abs(recipient.cbAfter), donor.cbAfter);
      donor.cbAfter     -= transfer;
      recipient.cbAfter += transfer;

      if (donor.cbAfter <= 1e-9) break;
    }
  }

  return working.map(w => ({
    shipId:   w.shipId,
    cbBefore: w.cbBefore,
    cbAfter:  w.cbAfter,
    transfer: w.cbAfter - w.cbBefore,
  }));
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validatePool(members: PoolMember[]): PoolValidation {
  const errors: ValidationError[] = [];

  if (members.length < 2) errors.push("TOO_FEW_MEMBERS");

  const seen = new Set<string>();
  for (const m of members) {
    if (seen.has(m.shipId)) { errors.push("DUPLICATE_SHIP"); break; }
    seen.add(m.shipId);
  }

  const poolSum = members.reduce((s, m) => s + m.cbBefore, 0);
  if (poolSum < -1e-9) errors.push("COLLECTIVE_DEFICIT");

  const surplusCount = members.filter(m => m.cbBefore > 0).length;
  const deficitCount = members.filter(m => m.cbBefore < 0).length;

  return {
    isValid:      errors.length === 0,
    errors,
    poolSum,
    surplusCount,
    deficitCount,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * usePooling
 *
 * Manages the entire Pooling tab state:
 *   - Member list (add / remove)
 *   - Live validation with typed error codes
 *   - Greedy allocation on createPool()
 *   - Reset to initial state
 *
 * All compliance math delegates to FUEL_EU domain constants.
 * The greedy algorithm here is a client-side preview;
 * the authoritative Pool.create() runs on the backend.
 */
export function usePooling(routes: RouteDTO[]): UsePoolingReturn {
  // Start with first two routes as default members
  const [members, setMembers]                 = useState<PoolMember[]>(
    routes.slice(0, 2).map(routeToMember)
  );
  const [allocationResult, setAllocationResult] = useState<AllocationResult[] | null>(null);
  const [isCreated, setIsCreated]               = useState(false);

  // ── Validation (recomputed on every member change) ─────────────────────────

  const validation = useMemo(() => validatePool(members), [members]);

  // ── Routes not yet in the pool ─────────────────────────────────────────────

  const memberIds = useMemo(() => new Set(members.map(m => m.shipId)), [members]);
  const availableRoutes = useMemo(
    () => routes.filter(r => !memberIds.has(r.routeId)),
    [routes, memberIds],
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const addMember = useCallback((route: RouteDTO) => {
    setMembers(prev => [...prev, routeToMember(route)]);
    setAllocationResult(null);
    setIsCreated(false);
  }, []);

  const removeMember = useCallback((shipId: string) => {
    setMembers(prev => {
      if (prev.length <= 2) return prev;   // enforce minimum 2
      return prev.filter(m => m.shipId !== shipId);
    });
    setAllocationResult(null);
    setIsCreated(false);
  }, []);

  const createPool = useCallback(() => {
    if (!validation.isValid) return;
    const result = greedyAllocate(members);
    setAllocationResult(result);
    setIsCreated(true);
  }, [members, validation.isValid]);

  const reset = useCallback(() => {
    setMembers(routes.slice(0, 2).map(routeToMember));
    setAllocationResult(null);
    setIsCreated(false);
  }, [routes]);

  return {
    availableRoutes,
    members,
    validation,
    allocationResult,
    isCreated,
    addMember,
    removeMember,
    createPool,
    reset,
  };
}
