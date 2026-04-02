import { useState, useMemo, useCallback } from "react";
import { FUEL_EU }                         from "@/core/domain/domain";
import type { RouteDTO }                   from "@/core/application/application";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompareMetrics {
  ghgIntensity:     number;
  complianceBalance: number;  // gCO₂e
  energyInScopeMJ:  number;
  fuelConsumption:  number;
  distance:         number;
  totalEmissions:   number;
  isCompliant:      boolean;
}

export interface CompareResult {
  routeA:     RouteDTO;
  routeB:     RouteDTO;
  metricsA:   CompareMetrics;
  metricsB:   CompareMetrics;
  /** ((B.ghg / A.ghg) - 1) × 100 — positive means B is worse */
  percentDiff:     number;
  /** Absolute difference in gCO₂e/MJ */
  absoluteDiff:    number;
  /** The route with lower GHG intensity */
  winner:          "A" | "B" | "equal";
  /** Difference in compliance balance (B - A) */
  cbDiff:          number;
  /** True if the routes are the same */
  isSameRoute:     boolean;
}

export interface UseCompareReturn {
  routes:       RouteDTO[];
  selectedA:    string;
  selectedB:    string;
  result:       CompareResult | null;
  selectA:      (routeId: string) => void;
  selectB:      (routeId: string) => void;
  swapRoutes:   () => void;
}

// ─── CB formula ───────────────────────────────────────────────────────────────

function computeCB(route: RouteDTO): number {
  return (FUEL_EU.TARGET_GHG_INTENSITY - route.ghgIntensity) * route.energyInScopeMJ;
}

function buildMetrics(route: RouteDTO): CompareMetrics {
  return {
    ghgIntensity:      route.ghgIntensity,
    complianceBalance: computeCB(route),
    energyInScopeMJ:   route.energyInScopeMJ,
    fuelConsumption:   route.fuelConsumption,
    distance:          route.distance,
    totalEmissions:    route.totalEmissions,
    isCompliant:       route.ghgIntensity <= FUEL_EU.TARGET_GHG_INTENSITY,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCompare
 *
 * Manages the route selection for the Compare tab and derives all
 * metrics from the current selection.
 * No API calls here — routes are passed in from the parent
 * (they've already been fetched by the routes tab or a shared store).
 */
export function useCompare(routes: RouteDTO[]): UseCompareReturn {
  const defaultA = routes[0]?.routeId ?? "";
  const defaultB = routes[1]?.routeId ?? "";

  const [selectedA, setSelectedA] = useState<string>(defaultA);
  const [selectedB, setSelectedB] = useState<string>(defaultB);

  // ── Derived comparison ────────────────────────────────────────────────────

  const result = useMemo<CompareResult | null>(() => {
    const routeA = routes.find(r => r.routeId === selectedA);
    const routeB = routes.find(r => r.routeId === selectedB);
    if (!routeA || !routeB) return null;

    const metricsA = buildMetrics(routeA);
    const metricsB = buildMetrics(routeB);

    const percentDiff  = ((routeB.ghgIntensity / routeA.ghgIntensity) - 1) * 100;
    const absoluteDiff = routeB.ghgIntensity - routeA.ghgIntensity;
    const cbDiff       = metricsB.complianceBalance - metricsA.complianceBalance;
    const isSameRoute  = selectedA === selectedB;

    let winner: CompareResult["winner"] = "equal";
    if (!isSameRoute) {
      if (routeA.ghgIntensity < routeB.ghgIntensity)      winner = "A";
      else if (routeB.ghgIntensity < routeA.ghgIntensity) winner = "B";
    }

    return {
      routeA, routeB, metricsA, metricsB,
      percentDiff, absoluteDiff, cbDiff,
      winner, isSameRoute,
    };
  }, [routes, selectedA, selectedB]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectA     = useCallback((id: string) => setSelectedA(id), []);
  const selectB     = useCallback((id: string) => setSelectedB(id), []);
  const swapRoutes  = useCallback(() => {
    setSelectedA(prev => {
      setSelectedB(prev);
      return selectedB;
    });
  }, [selectedB]);

  return { routes, selectedA, selectedB, result, selectA, selectB, swapRoutes };
}
