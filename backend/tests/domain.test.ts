// =============================================================================
// Unit Tests — Domain Layer
// Tests: ComplianceBalance, BankEntry, Pool.create()
// Runner: Jest (ts-jest)
// =============================================================================

import {
  Route,
  ComplianceBalance,
  BankEntry,
  Pool,
  DomainError,
  InvariantViolation,
  FUEL_EU,
  type RouteProps,
  type PoolMemberInput,
} from "../src/core/domain/domain";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_ROUTE_PROPS: RouteProps = {
  routeId:         "R001",
  vesselType:      "Container",
  fuelType:        "HFO",
  year:            2024,
  ghgIntensity:    91.0,     // above target → deficit
  fuelConsumption: 5000,
  distance:        12000,
  totalEmissions:  4500,
};

const SURPLUS_ROUTE_PROPS: RouteProps = {
  ...VALID_ROUTE_PROPS,
  routeId:      "R002",
  fuelType:     "LNG",
  ghgIntensity: 88.0,        // below target → surplus
};

const EXACT_ROUTE_PROPS: RouteProps = {
  ...VALID_ROUTE_PROPS,
  routeId:      "R_EXACT",
  ghgIntensity: FUEL_EU.TARGET_GHG_INTENSITY, // exactly at target
};

function makeRoute(props: Partial<RouteProps> = {}, baseline = false): Route {
  return Route.create({ ...VALID_ROUTE_PROPS, ...props }, baseline);
}

function makeSurplusRoute(props: Partial<RouteProps> = {}): Route {
  return Route.create({ ...SURPLUS_ROUTE_PROPS, ...props });
}

// ─── ComplianceBalance ────────────────────────────────────────────────────────

describe("ComplianceBalance", () => {

  // ── CB formula ──────────────────────────────────────────────────────────────

  describe("formula: CB = (Target − Actual) × Energy", () => {
    it("computes a negative CB (deficit) when intensity is above the target", () => {
      const route = makeRoute({ ghgIntensity: 91.0, fuelConsumption: 5000 });
      const cb    = ComplianceBalance.forRoute("SHIP-01", 2024, route);

      const expected = (FUEL_EU.TARGET_GHG_INTENSITY - 91.0) * (5000 * FUEL_EU.LHV_MJ_PER_TONNE);
      expect(cb.cb).toBeCloseTo(expected, 2);
      expect(cb.cb).toBeLessThan(0);
    });

    it("computes a positive CB (surplus) when intensity is below the target", () => {
      const route = makeSurplusRoute({ fuelConsumption: 4800 });
      const cb    = ComplianceBalance.forRoute("SHIP-02", 2024, route);

      const expected = (FUEL_EU.TARGET_GHG_INTENSITY - 88.0) * (4800 * FUEL_EU.LHV_MJ_PER_TONNE);
      expect(cb.cb).toBeCloseTo(expected, 2);
      expect(cb.cb).toBeGreaterThan(0);
    });

    it("computes CB = 0 when intensity exactly equals the target", () => {
      const route = makeRoute({ ghgIntensity: FUEL_EU.TARGET_GHG_INTENSITY });
      const cb    = ComplianceBalance.forRoute("SHIP-03", 2024, route);

      expect(cb.cb).toBeCloseTo(0, 4);
    });

    it("uses fuelConsumption × 41000 for energy in scope", () => {
      const route = makeRoute({ ghgIntensity: 91.0, fuelConsumption: 1 });
      const cb    = ComplianceBalance.forRoute("SHIP-04", 2024, route);
      // With 1 tonne fuel: Energy = 41000 MJ, delta = 89.3368 - 91.0 = -1.6632
      expect(cb.cb).toBeCloseTo(-1.6632 * 41000, 1);
    });

    it("scales linearly with fuelConsumption", () => {
      const cb1 = ComplianceBalance.forRoute("S1", 2024, makeRoute({ fuelConsumption: 1000 }));
      const cb2 = ComplianceBalance.forRoute("S2", 2024, makeRoute({ fuelConsumption: 2000 }));
      expect(cb2.cb).toBeCloseTo(cb1.cb * 2, 2);
    });

    it("matches the exact assignment dataset values", () => {
      // R001: Container / HFO / 2024, ghg=91.0, fuel=5000
      const r001 = makeRoute({ ghgIntensity: 91.0, fuelConsumption: 5000 });
      const cb   = ComplianceBalance.forRoute("SHIP-R001", 2024, r001);
      // (89.3368 - 91.0) × 5000 × 41000 = -1.6632 × 205000000 = -340,956,000
      expect(cb.cb).toBeCloseTo(-340_956_000, -3);

      // R002: BulkCarrier / LNG / 2024, ghg=88.0, fuel=4800
      const r002 = makeSurplusRoute({ fuelConsumption: 4800 });
      const cb2  = ComplianceBalance.forRoute("SHIP-R002", 2024, r002);
      // (89.3368 - 88.0) × 4800 × 41000 = 1.3368 × 196800000 = 263,082,240
      expect(cb2.cb).toBeCloseTo(263_082_240, -3);
    });
  });

  // ── Classification helpers ──────────────────────────────────────────────────

  describe("classification", () => {
    it("isSurplus() returns true when cb > 0", () => {
      const cb = ComplianceBalance.forRoute("S", 2024, makeSurplusRoute());
      expect(cb.isSurplus()).toBe(true);
      expect(cb.isDeficit()).toBe(false);
      expect(cb.isExact()).toBe(false);
    });

    it("isDeficit() returns true when cb < 0", () => {
      const cb = ComplianceBalance.forRoute("S", 2024, makeRoute());
      expect(cb.isDeficit()).toBe(true);
      expect(cb.isSurplus()).toBe(false);
      expect(cb.isExact()).toBe(false);
    });

    it("isExact() returns true when cb === 0", () => {
      const route = makeRoute({ ghgIntensity: FUEL_EU.TARGET_GHG_INTENSITY });
      const cb    = ComplianceBalance.forRoute("S", 2024, route);
      expect(cb.isExact()).toBe(true);
    });
  });

  // ── applyBanked ─────────────────────────────────────────────────────────────

  describe("applyBanked()", () => {
    it("produces AdjustedCB with correct cbAfter", () => {
      const route   = makeRoute();   // deficit
      const cb      = ComplianceBalance.forRoute("S", 2024, route);
      const deficit = Math.abs(cb.cb);
      const apply   = deficit * 0.5;

      const adj = cb.applyBanked(apply);

      expect(adj.cbBefore).toBe(cb.cb);
      expect(adj.applied).toBeCloseTo(apply, 4);
      expect(adj.cbAfter).toBeCloseTo(cb.cb + apply, 4);
    });

    it("throws DomainError when ship is not in deficit", () => {
      const route = makeSurplusRoute();
      const cb    = ComplianceBalance.forRoute("S", 2024, route);

      expect(() => cb.applyBanked(100)).toThrow(DomainError);
    });

    it("throws DomainError when amount exceeds deficit", () => {
      const route  = makeRoute();
      const cb     = ComplianceBalance.forRoute("S", 2024, route);
      const tooMuch = Math.abs(cb.cb) + 1;

      expect(() => cb.applyBanked(tooMuch)).toThrow(DomainError);
    });

    it("throws DomainError when bankedAmount < 0", () => {
      const route = makeRoute();
      const cb    = ComplianceBalance.forRoute("S", 2024, route);

      expect(() => cb.applyBanked(-1)).toThrow(DomainError);
    });

    it("allows applying the full deficit exactly", () => {
      const route  = makeRoute();
      const cb     = ComplianceBalance.forRoute("S", 2024, route);
      const adj    = cb.applyBanked(Math.abs(cb.cb));

      expect(adj.cbAfter).toBeCloseTo(0, 4);
    });
  });

  // ── Invariants ──────────────────────────────────────────────────────────────

  describe("invariants", () => {
    it("throws when shipId is empty", () => {
      expect(() => ComplianceBalance.forRoute("", 2024, makeRoute()))
        .toThrow(InvariantViolation);
    });

    it("throws when year is outside regulatory window", () => {
      expect(() => ComplianceBalance.forRoute("S", 2023, makeRoute()))
        .toThrow(InvariantViolation);
      expect(() => ComplianceBalance.forRoute("S", 2051, makeRoute()))
        .toThrow(InvariantViolation);
    });

    it("toSnapshot() returns a serialisable plain object", () => {
      const cb   = ComplianceBalance.forRoute("S", 2024, makeRoute());
      const snap = cb.toSnapshot();

      expect(snap.shipId).toBe("S");
      expect(snap.year).toBe(2024);
      expect(snap.routeId).toBe("R001");
      expect(snap.cbGco2eq).toBe(cb.cb);
      expect(snap.isSurplus).toBe(cb.isSurplus());
    });
  });
});

// ─── BankEntry ────────────────────────────────────────────────────────────────

describe("BankEntry", () => {

  function makeSurplusCB(): ComplianceBalance {
    return ComplianceBalance.forRoute("SHIP-A", 2024, makeSurplusRoute());
  }

  function makeDeficitCB(): ComplianceBalance {
    return ComplianceBalance.forRoute("SHIP-B", 2024, makeRoute());
  }

  describe("BankEntry.bank()", () => {
    it("creates an entry from a surplus CB", () => {
      const cb    = makeSurplusCB();
      const entry = BankEntry.bank("be-1", cb);

      expect(entry.amountGco2eq).toBeCloseTo(cb.cb, 4);
      expect(entry.appliedAmount).toBe(0);
      expect(entry.availableBalance).toBeCloseTo(cb.cb, 4);
      expect(entry.status()).toBe("banked");
      expect(entry.isClosed()).toBe(false);
    });

    it("throws DomainError when CB is a deficit", () => {
      const cb = makeDeficitCB();
      expect(() => BankEntry.bank("be-2", cb)).toThrow(DomainError);
    });
  });

  describe("apply()", () => {
    it("deducts the requested amount from the available balance", () => {
      const cb    = makeSurplusCB();
      const entry = BankEntry.bank("be-1", cb);
      const full  = entry.amountGco2eq;
      const draw  = full * 0.3;

      const actual = entry.apply(draw);

      expect(actual).toBeCloseTo(draw, 4);
      expect(entry.appliedAmount).toBeCloseTo(draw, 4);
      expect(entry.availableBalance).toBeCloseTo(full - draw, 4);
      expect(entry.status()).toBe("partially_applied");
    });

    it("returns less than requested when balance is insufficient (clamping)", () => {
      const cb    = makeSurplusCB();
      const entry = BankEntry.bank("be-2", cb);
      const full  = entry.amountGco2eq;

      const actual = entry.apply(full * 2);   // ask for more than available

      expect(actual).toBeCloseTo(full, 4);    // only available balance returned
      expect(entry.status()).toBe("fully_applied");
      expect(entry.isClosed()).toBe(true);
    });

    it("marks status as fully_applied when balance reaches zero", () => {
      const cb    = makeSurplusCB();
      const entry = BankEntry.bank("be-3", cb);

      entry.apply(entry.amountGco2eq);

      expect(entry.status()).toBe("fully_applied");
      expect(entry.availableBalance).toBeCloseTo(0, 4);
    });

    it("throws DomainError when entry is already closed", () => {
      const cb    = makeSurplusCB();
      const entry = BankEntry.bank("be-4", cb);
      entry.apply(entry.amountGco2eq);         // drain it

      expect(() => entry.apply(1)).toThrow(DomainError);
    });

    it("throws DomainError when requested amount is <= 0", () => {
      const cb    = makeSurplusCB();
      const entry = BankEntry.bank("be-5", cb);

      expect(() => entry.apply(0)).toThrow(DomainError);
      expect(() => entry.apply(-1)).toThrow(DomainError);
    });

    it("accumulates correctly across multiple apply() calls", () => {
      const cb    = makeSurplusCB();
      const entry = BankEntry.bank("be-6", cb);
      const full  = entry.amountGco2eq;

      entry.apply(full * 0.25);
      entry.apply(full * 0.25);
      entry.apply(full * 0.25);

      expect(entry.appliedAmount).toBeCloseTo(full * 0.75, 4);
      expect(entry.status()).toBe("partially_applied");
    });
  });
});

// ─── Pool ─────────────────────────────────────────────────────────────────────

describe("Pool.create()", () => {

  const SURPLUS_A: PoolMemberInput = { shipId: "A", adjustedCb:  500_000_000 };
  const SURPLUS_B: PoolMemberInput = { shipId: "B", adjustedCb:  200_000_000 };
  const DEFICIT_C: PoolMemberInput = { shipId: "C", adjustedCb: -300_000_000 };
  const DEFICIT_D: PoolMemberInput = { shipId: "D", adjustedCb: -100_000_000 };
  const ZERO_E:    PoolMemberInput = { shipId: "E", adjustedCb:  0 };

  // ── Pre-condition invariants ────────────────────────────────────────────────

  describe("pre-conditions", () => {
    it("rejects empty pool id", () => {
      expect(() => Pool.create("", 2024, [SURPLUS_A, DEFICIT_C]))
        .toThrow(InvariantViolation);
    });

    it("rejects year outside 2024–2050", () => {
      expect(() => Pool.create("p1", 2023, [SURPLUS_A, DEFICIT_C]))
        .toThrow(InvariantViolation);
      expect(() => Pool.create("p1", 2051, [SURPLUS_A, DEFICIT_C]))
        .toThrow(InvariantViolation);
    });

    it("rejects fewer than 2 members", () => {
      expect(() => Pool.create("p1", 2024, [SURPLUS_A]))
        .toThrow(InvariantViolation);
    });

    it("rejects duplicate shipIds", () => {
      const dup: PoolMemberInput = { shipId: "A", adjustedCb: 100 };
      expect(() => Pool.create("p1", 2024, [SURPLUS_A, dup]))
        .toThrow(InvariantViolation);
    });

    it("rejects when ∑ adjustedCB < 0 (collective deficit)", () => {
      // Two deficit ships — sum is negative
      const bigDeficit: PoolMemberInput = { shipId: "X", adjustedCb: -800_000_000 };
      const smallSurplus: PoolMemberInput = { shipId: "Y", adjustedCb: 100_000_000 };
      expect(() => Pool.create("p1", 2024, [bigDeficit, smallSurplus]))
        .toThrow(InvariantViolation);
    });

    it("accepts when ∑ adjustedCB = 0 exactly", () => {
      const neg: PoolMemberInput = { shipId: "N", adjustedCb: -100 };
      const pos: PoolMemberInput = { shipId: "P", adjustedCb:  100 };
      expect(() => Pool.create("p1", 2024, [neg, pos])).not.toThrow();
    });
  });

  // ── Greedy allocation ────────────────────────────────────────────────────────

  describe("greedy allocation", () => {
    it("covers a single deficit from a single surplus", () => {
      const pool = Pool.create("p1", 2024, [SURPLUS_A, DEFICIT_C]);
      const a    = pool.memberResult("A")!;
      const c    = pool.memberResult("C")!;

      // C had -300M, A had +500M → A gives 300M to C
      expect(c.cbAfter).toBeCloseTo(0, 0);
      expect(a.cbAfter).toBeCloseTo(200_000_000, 0);
      expect(pool.poolSum()).toBeGreaterThanOrEqual(0);
    });

    it("distributes across multiple deficits", () => {
      const pool = Pool.create("p1", 2024, [SURPLUS_A, DEFICIT_C, DEFICIT_D]);
      const c    = pool.memberResult("C")!;
      const d    = pool.memberResult("D")!;

      expect(c.cbAfter).toBeCloseTo(0, 0);
      expect(d.cbAfter).toBeCloseTo(0, 0);
    });

    it("uses multiple surplus ships to cover a large deficit", () => {
      const bigDef: PoolMemberInput = { shipId: "X", adjustedCb: -600_000_000 };
      const pool = Pool.create("p1", 2024, [SURPLUS_A, SURPLUS_B, bigDef]);
      const x    = pool.memberResult("X")!;

      // A=500M + B=200M covers 600M deficit exactly; remaining 100M stays with A or B
      expect(x.cbAfter).toBeCloseTo(0, 0);
      expect(pool.poolSum()).toBeGreaterThanOrEqual(-1e-9);
    });

    it("leaves zero-CB members unchanged", () => {
      const pool = Pool.create("p1", 2024, [SURPLUS_A, DEFICIT_C, ZERO_E]);
      const e    = pool.memberResult("E")!;

      expect(e.cbAfter).toBeCloseTo(0, 4);
      expect(e.transfer).toBeCloseTo(0, 4);
    });

    it("transfer = cbAfter − cbBefore for every member", () => {
      const pool = Pool.create("p1", 2024, [SURPLUS_A, DEFICIT_C, DEFICIT_D]);

      for (const m of pool.members) {
        expect(m.transfer).toBeCloseTo(m.cbAfter - m.cbBefore, 4);
      }
    });

    it("pool sum is non-negative after allocation", () => {
      const pool = Pool.create("p1", 2024, [SURPLUS_A, SURPLUS_B, DEFICIT_C, DEFICIT_D]);
      expect(pool.poolSum()).toBeGreaterThanOrEqual(-1e-9);
      expect(pool.isBalanced()).toBe(true);
    });

    it("does not produce residual fractional errors above 1e-4", () => {
      // Use values that could produce floating-point drift
      const a: PoolMemberInput = { shipId: "A", adjustedCb:  1 / 3 * 1e9 };
      const b: PoolMemberInput = { shipId: "B", adjustedCb: -1 / 3 * 1e9 };
      const pool = Pool.create("p", 2024, [a, b]);
      expect(pool.poolSum()).toBeGreaterThanOrEqual(-1e-4);
    });
  });

  // ── Post-condition invariants ────────────────────────────────────────────────

  describe("post-conditions (Article 21 member rules)", () => {
    it("deficit ship does not exit worse than it entered", () => {
      const pool = Pool.create("p1", 2024, [SURPLUS_A, DEFICIT_C]);
      const c    = pool.memberResult("C")!;

      expect(c.cbAfter).toBeGreaterThanOrEqual(c.cbBefore - 1e-9);
    });

    it("surplus ship does not exit with a negative CB", () => {
      // SURPLUS_B=200M cannot fully cover DEFICIT_C=-300M alone; pool is invalid
      // Use a valid pool: SURPLUS_A+SURPLUS_B vs DEFICIT_C+DEFICIT_D
      const pool = Pool.create("p1", 2024, [SURPLUS_A, SURPLUS_B, DEFICIT_C, DEFICIT_D]);
      for (const m of pool.members.filter(m => m.cbBefore > 0)) {
        expect(m.cbAfter).toBeGreaterThanOrEqual(-1e-9);
      }
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles two surplus-only members (no allocation needed)", () => {
      const pool = Pool.create("p1", 2024, [SURPLUS_A, SURPLUS_B]);
      const a    = pool.memberResult("A")!;
      const b    = pool.memberResult("B")!;

      expect(a.cbAfter).toBeCloseTo(SURPLUS_A.adjustedCb, 0);
      expect(b.cbAfter).toBeCloseTo(SURPLUS_B.adjustedCb, 0);
      expect(a.transfer).toBeCloseTo(0, 0);
    });

    it("correctly handles minimal 2-member surplus+deficit pool", () => {
      const s: PoolMemberInput = { shipId: "S", adjustedCb: 1000 };
      const d: PoolMemberInput = { shipId: "D", adjustedCb: -1000 };
      const pool = Pool.create("p", 2024, [s, d]);

      expect(pool.memberResult("D")!.cbAfter).toBeCloseTo(0, 4);
      expect(pool.memberResult("S")!.cbAfter).toBeCloseTo(0, 4);
    });
  });
});
