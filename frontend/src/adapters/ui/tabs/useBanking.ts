import { useState, useMemo, useCallback } from "react";
import { FUEL_EU }                         from "@/core/domain/domain";
import type { RouteDTO }                   from "@/core/application/application";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxType   = "bank" | "apply";
export type TxStatus = "confirmed" | "applied" | "pending";

export interface Transaction {
  id:        string;
  type:      TxType;
  routeId:   string;
  vesselType: string;
  fuelType:  string;
  amountGco2eq: number;     // always positive; sign is determined by type
  timestamp: Date;
  status:    TxStatus;
}

export interface BankingState {
  /** Raw CB for the selected route — positive = surplus, negative = deficit */
  cbGco2eq:        number;
  /** Accumulated banked balance across all open bank entries */
  bankBalanceGco2eq: number;
  /** Energy in scope (MJ) — fuelConsumption × LHV */
  energyInScopeMJ: number;
  isSurplus:       boolean;
  isDeficit:       boolean;
  /** Amount the user could bank right now (surplus routes only) */
  bankableAmount:  number;
  /** Amount the user could apply right now (deficit routes with existing balance) */
  applicableAmount: number;
  /** Whether the "Bank surplus" action is available */
  canBank:         boolean;
  /** Whether the "Apply credits" action is available */
  canApply:        boolean;
}

export interface UseBankingReturn {
  routes:          RouteDTO[];
  selectedRouteId: string;
  selectRoute:     (id: string) => void;
  selectedRoute:   RouteDTO | undefined;
  state:           BankingState;
  transactions:    Transaction[];
  bankSurplus:     (amountGco2eq: number) => void;
  applyBanked:     (amountGco2eq: number) => void;
  clearHistory:    () => void;
}

// ─── ID generation ────────────────────────────────────────────────────────────

function shortId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBanking
 *
 * Manages the entire Banking tab:
 *   - Route selection
 *   - CB computation (delegates formula to domain constants)
 *   - In-memory bank balance (replace with API calls in production)
 *   - Transaction ledger
 *   - Action guards (canBank, canApply)
 *
 * The hook contains NO business logic — all formula constants come from
 * FUEL_EU (the domain layer), and invariants (e.g. cannot bank a deficit)
 * are enforced here as the boundary between UI and domain.
 */
export function useBanking(routes: RouteDTO[]): UseBankingReturn {
  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.routeId ?? "");
  const [bankBalance, setBankBalance]         = useState<number>(0);
  const [transactions, setTransactions]       = useState<Transaction[]>([]);

  // ── Selected route ────────────────────────────────────────────────────────

  const selectedRoute = useMemo(
    () => routes.find(r => r.routeId === selectedRouteId),
    [routes, selectedRouteId],
  );

  // ── Derived banking state ─────────────────────────────────────────────────

  const state = useMemo<BankingState>(() => {
    if (!selectedRoute) {
      return {
        cbGco2eq: 0, bankBalanceGco2eq: bankBalance,
        energyInScopeMJ: 0,
        isSurplus: false, isDeficit: false,
        bankableAmount: 0, applicableAmount: 0,
        canBank: false, canApply: false,
      };
    }

    const energyInScopeMJ = selectedRoute.fuelConsumption * FUEL_EU.LHV_MJ_PER_TONNE;
    const cbGco2eq        = (FUEL_EU.TARGET_GHG_INTENSITY - selectedRoute.ghgIntensity) * energyInScopeMJ;
    const isSurplus       = cbGco2eq > 0;
    const isDeficit       = cbGco2eq < 0;

    // What the user can bank: up to the full surplus amount
    const bankableAmount = isSurplus ? cbGco2eq : 0;

    // What the user can apply: min of the deficit and the available balance
    const applicableAmount = isDeficit
      ? Math.min(Math.abs(cbGco2eq), bankBalance)
      : 0;

    return {
      cbGco2eq,
      bankBalanceGco2eq: bankBalance,
      energyInScopeMJ,
      isSurplus,
      isDeficit,
      bankableAmount,
      applicableAmount,
      canBank:  isSurplus && bankableAmount > 0,
      canApply: isDeficit && bankBalance > 0,
    };
  }, [selectedRoute, bankBalance]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectRoute = useCallback((id: string) => setSelectedRouteId(id), []);

  const bankSurplus = useCallback((amountGco2eq: number) => {
    if (!selectedRoute || !state.canBank) return;
    const actual = Math.min(amountGco2eq, state.bankableAmount);
    if (actual <= 0) return;

    setBankBalance(prev => prev + actual);
    setTransactions(prev => [{
      id:          shortId("BE"),
      type:        "bank",
      routeId:     selectedRoute.routeId,
      vesselType:  selectedRoute.vesselType,
      fuelType:    selectedRoute.fuelType,
      amountGco2eq: actual,
      timestamp:   new Date(),
      status:      "confirmed",
    }, ...prev]);
  }, [selectedRoute, state.canBank, state.bankableAmount]);

  const applyBanked = useCallback((amountGco2eq: number) => {
    if (!selectedRoute || !state.canApply) return;
    const actual = Math.min(amountGco2eq, state.applicableAmount, bankBalance);
    if (actual <= 0) return;

    setBankBalance(prev => Math.max(0, prev - actual));
    setTransactions(prev => [{
      id:          shortId("AP"),
      type:        "apply",
      routeId:     selectedRoute.routeId,
      vesselType:  selectedRoute.vesselType,
      fuelType:    selectedRoute.fuelType,
      amountGco2eq: actual,
      timestamp:   new Date(),
      status:      "applied",
    }, ...prev]);
  }, [selectedRoute, state.canApply, state.applicableAmount, bankBalance]);

  const clearHistory = useCallback(() => setTransactions([]), []);

  return {
    routes, selectedRouteId, selectRoute, selectedRoute,
    state, transactions, bankSurplus, applyBanked, clearHistory,
  };
}
