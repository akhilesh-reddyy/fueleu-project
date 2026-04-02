// =============================================================================
// FuelEU Maritime — Route API Client
// Implements outbound HTTP calls to the backend.
// All functions return domain DTOs — no raw fetch logic leaks into components.
// =============================================================================

import type {
  RouteDTO,
  RouteFilters,
  RouteListOutput,
  SetBaselineOutput,
  RouteComparisonOutput,
  ComputeCBOutput,
  AdjustedCBOutput,
  BankRecordsOutput,
  BankSurplusOutput,
  ApplyBankedOutput,
  CreatePoolOutput,
  CreatePoolInput,
} from "@/core/application/application";

const BASE = "/api/v1";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  const { data } = await res.json();
  return data as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  }
  const { data } = await res.json();
  return data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join("&")}` : "";
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const routeApi = {
  list(filters?: RouteFilters): Promise<RouteListOutput> {
    return get<RouteListOutput>(`/routes${qs({ year: filters?.year, vesselType: filters?.vesselType, fuelType: filters?.fuelType })}`);
  },

  setBaseline(routeId: string): Promise<SetBaselineOutput> {
    return post<SetBaselineOutput>(`/routes/${encodeURIComponent(routeId)}/baseline`);
  },

  comparison(year: number): Promise<RouteComparisonOutput> {
    return get<RouteComparisonOutput>(`/routes/comparison${qs({ year })}`);
  },
};

// ─── Compliance ───────────────────────────────────────────────────────────────

export const complianceApi = {
  getCB(shipId: string, routeId: string, year: number): Promise<ComputeCBOutput> {
    return get<ComputeCBOutput>(`/compliance/cb${qs({ shipId, routeId, year })}`);
  },

  getAdjustedCB(shipId: string, year: number): Promise<AdjustedCBOutput> {
    return get<AdjustedCBOutput>(`/compliance/adjusted-cb${qs({ shipId, year })}`);
  },
};

// ─── Banking ──────────────────────────────────────────────────────────────────

export const bankingApi = {
  records(shipId: string, year: number): Promise<BankRecordsOutput> {
    return get<BankRecordsOutput>(`/banking/records${qs({ shipId, year })}`);
  },

  bank(shipId: string, routeId: string, year: number): Promise<BankSurplusOutput> {
    return post<BankSurplusOutput>("/banking/bank", { shipId, routeId, year });
  },

  apply(shipId: string, routeId: string, year: number, amountToApply: number): Promise<ApplyBankedOutput> {
    return post<ApplyBankedOutput>("/banking/apply", { shipId, routeId, year, amountToApply });
  },
};

// ─── Pools ────────────────────────────────────────────────────────────────────

export const poolApi = {
  create(input: CreatePoolInput): Promise<CreatePoolOutput> {
    return post<CreatePoolOutput>("/pools", input);
  },
};
