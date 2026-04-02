import { AnimatePresence, motion } from "framer-motion";
import { usePooling }              from "./usePooling";
import { PoolMembers }             from "./PoolMembers";
import type { RouteDTO }           from "@/core/application/application";

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_ROUTES: RouteDTO[] = [
  { routeId:"R001", vesselType:"Container",   fuelType:"HFO", year:2024, ghgIntensity:91.0, fuelConsumption:5000, distance:12000, totalEmissions:4500, isBaseline:true,  isCompliant:false, energyInScopeMJ:5000*41000 },
  { routeId:"R002", vesselType:"BulkCarrier", fuelType:"LNG", year:2024, ghgIntensity:88.0, fuelConsumption:4800, distance:11500, totalEmissions:4200, isBaseline:false, isCompliant:true,  energyInScopeMJ:4800*41000 },
  { routeId:"R003", vesselType:"Tanker",      fuelType:"MGO", year:2024, ghgIntensity:93.5, fuelConsumption:5100, distance:12500, totalEmissions:4700, isBaseline:false, isCompliant:false, energyInScopeMJ:5100*41000 },
  { routeId:"R004", vesselType:"RoRo",        fuelType:"HFO", year:2025, ghgIntensity:89.2, fuelConsumption:4900, distance:11800, totalEmissions:4300, isBaseline:false, isCompliant:true,  energyInScopeMJ:4900*41000 },
  { routeId:"R005", vesselType:"Container",   fuelType:"LNG", year:2025, ghgIntensity:90.5, fuelConsumption:4950, distance:11900, totalEmissions:4400, isBaseline:false, isCompliant:false, energyInScopeMJ:4950*41000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mono = "'SF Mono','Fira Code',ui-monospace,monospace";

function formatM(n: number): string {
  return (n >= 0 ? "+" : "−") + (Math.abs(n) / 1e6).toFixed(2) + "M";
}

// ─── Summary panel ────────────────────────────────────────────────────────────

function SummaryPanel({ pooling }: { pooling: ReturnType<typeof usePooling> }) {
  const { validation: v } = pooling;
  const isValid  = v.isValid;
  const borderColor = isValid ? "rgba(52,211,153,0.20)" : "rgba(251,113,133,0.17)";
  const glowShadow  = isValid
    ? "0 0 0 1px rgba(52,211,153,0.07), 0 8px 40px rgba(5,150,105,0.14)"
    : "0 0 0 1px rgba(251,113,133,0.06), 0 8px 40px rgba(190,18,60,0.12)";
  const orbColor = isValid ? "#059669" : "#be123c";
  const valColor = v.poolSum >= 0 ? "#34d399" : "#fb7185";

  const statusText = v.errors.includes("TOO_FEW_MEMBERS")   ? "Add at least 2 ships"
                   : v.errors.includes("DUPLICATE_SHIP")     ? "Duplicate ships detected"
                   : v.errors.includes("COLLECTIVE_DEFICIT") ? "Collective deficit — invalid"
                   : "Valid pool — ∑CB ≥ 0";

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-[20px] border"
      style={{
        background:   "linear-gradient(160deg, rgba(16,21,32,0.92), rgba(10,14,22,0.97))",
        borderColor,
        boxShadow:    glowShadow,
        transition:   "border-color 0.4s, box-shadow 0.4s",
        padding:      "26px 28px",
        marginBottom: 20,
      }}
    >
      {/* Top highlight */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)" }} />

      {/* Ambient orbs */}
      <div
        aria-hidden
        className="absolute -top-12 -right-8 rounded-full pointer-events-none"
        style={{ width: 300, height: 200, background: orbColor, filter: "blur(60px)", opacity: 0.16, transition: "background 0.5s" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-12 -left-5 rounded-full pointer-events-none"
        style={{ width: 200, height: 180, background: orbColor, filter: "blur(55px)", opacity: 0.08 }}
      />

      {/* Main row */}
      <div className="flex items-start justify-between mb-6 relative">
        <div>
          <p className="text-[10.5px] font-[500] uppercase tracking-[0.1em] text-slate-500 mb-2">
            Pool ∑ compliance balance
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={v.poolSum.toFixed(0)}
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="flex items-baseline gap-2"
            >
              <span
                className="font-[700] leading-none"
                style={{ fontSize: 52, letterSpacing: "-0.058em", color: valColor, fontFamily: mono }}
              >
                {formatM(v.poolSum)}
              </span>
              <span className="text-[15px] font-[500] text-slate-500 pb-1">gCO₂e</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Validity pill */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isValid ? "valid" : "invalid"}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-end gap-2"
          >
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-[12px] font-[600]"
              style={{
                background: isValid ? "rgba(5,150,105,0.10)" : "rgba(190,18,60,0.11)",
                border:     `1px solid ${isValid ? "rgba(52,211,153,0.18)" : "rgba(251,113,133,0.16)"}`,
                color:      isValid ? "#34d399" : "#fb7185",
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: isValid ? "#34d399" : "#fb7185",
                  boxShadow:  `0 0 0 3px ${isValid ? "rgba(52,211,153,0.2)" : "rgba(251,113,133,0.18)"}`,
                  animation:  "pulse 2s ease-in-out infinite",
                }}
              />
              {statusText}
            </div>

            {v.errors.includes("COLLECTIVE_DEFICIT") && (
              <p className="text-[11px] text-slate-500 text-right">
                Pool sum must be ≥ 0 (Article 21)
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stats strip */}
      <div
        className="grid grid-cols-4 overflow-hidden rounded-[14px] border"
        style={{ borderColor: "rgba(255,255,255,0.056)", background: "rgba(255,255,255,0.04)" }}
      >
        {[
          { label: "Members",       value: String(pooling.members.length), sub: "ships" },
          { label: "Surplus ships", value: String(v.surplusCount),         sub: "above target", color: "#34d399" },
          { label: "Deficit ships", value: String(v.deficitCount),         sub: "below target", color: "#fb7185" },
          { label: "FuelEU target", value: "89.34",                        sub: "gCO₂e/MJ",    color: "#fbbf24" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="px-4 py-3.5"
            style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.056)" : undefined, background: "rgba(0,0,0,0.26)" }}
          >
            <p className="text-[10px] font-[500] uppercase tracking-[0.1em] text-slate-500 mb-1.5">{s.label}</p>
            <p className="text-[14.5px] font-[700] tracking-[-0.025em]" style={{ fontFamily: mono, color: s.color ?? "#f1f5f9" }}>
              {s.value}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Allocation result ────────────────────────────────────────────────────────

function AllocationResult({ result }: { result: NonNullable<ReturnType<typeof usePooling>["allocationResult"]> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[16px] border"
      style={{
        background:  "linear-gradient(145deg, rgba(16,21,32,0.88), rgba(12,16,24,0.96))",
        borderColor: "rgba(52,211,153,0.18)",
        boxShadow:   "0 0 0 1px rgba(52,211,153,0.06), 0 6px 28px rgba(0,0,0,0.25)",
      }}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />

      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.055)", background: "rgba(0,0,0,0.17)" }}
      >
        <div>
          <h3 className="text-[13px] font-[600] tracking-[-0.02em] text-slate-100">Allocation result</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Article 21 · greedy surplus allocation</p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[10.5px] font-[600]"
          style={{ background: "rgba(5,150,105,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.14)" }}
        >
          <span className="w-[5px] h-[5px] rounded-full bg-emerald-400" />
          Complete
        </span>
      </div>

      <div>
        {result.map((r, i) => (
          <motion.div
            key={r.shipId}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.035] last:border-none"
            style={{ transition: "background 0.12s" }}
            whileHover={{ background: "rgba(255,255,255,0.024)" } as any}
          >
            <span className="flex-shrink-0 text-[12px] font-[600] text-indigo-400 w-[56px]" style={{ fontFamily: mono }}>
              {r.shipId}
            </span>
            <span className="flex-1 text-[12px] font-[600]" style={{ fontFamily: mono, color: r.cbBefore > 0 ? "#34d399" : "#fb7185" }}>
              {formatM(r.cbBefore)}
            </span>
            <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M1 5h10M7 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex-1 text-[12.5px] font-[700] text-right" style={{ fontFamily: mono, color: r.cbAfter >= 0 ? "#34d399" : "#fb7185" }}>
              {formatM(r.cbAfter)}
            </span>
            <span
              className="flex-shrink-0 text-[10.5px] font-[600] text-right w-[72px]"
              style={{ fontFamily: mono, color: r.transfer > 0 ? "#34d399" : r.transfer < 0 ? "#a5b4fc" : "#475569" }}
            >
              {r.transfer > 0 ? "+" : r.transfer < 0 ? "−" : ""}
              {(Math.abs(r.transfer) / 1e6).toFixed(2)}M
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PoolingPage() {
  const pooling = usePooling(SEED_ROUTES);
  const { validation, allocationResult, isCreated, createPool, reset } = pooling;

  return (
    <div className="space-y-5">

      {/* Summary panel */}
      <SummaryPanel pooling={pooling} />

      {/* Members grid */}
      <PoolMembers
        members={pooling.members}
        availableRoutes={pooling.availableRoutes}
        allocationResult={allocationResult}
        onAdd={pooling.addMember}
        onRemove={pooling.removeMember}
      />

      {/* Create / Reset action */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileHover={validation.isValid && !isCreated ? {
            y: -1.5,
            boxShadow: "0 6px 26px rgba(5,150,105,0.42), 0 0 0 1px rgba(52,211,153,0.15)",
          } : {}}
          whileTap={{ scale: 0.97 }}
          disabled={!validation.isValid || isCreated}
          onClick={createPool}
          className="flex-1 py-3.5 rounded-[14px] text-[13.5px] font-[600] flex items-center justify-center gap-2.5 transition-all duration-200 border-none"
          style={{
            background:   validation.isValid && !isCreated
              ? "linear-gradient(135deg, #065f46, #059669)"
              : "rgba(255,255,255,0.05)",
            color:        validation.isValid && !isCreated ? "#d1fae5" : "#475569",
            cursor:       validation.isValid && !isCreated ? "pointer" : "not-allowed",
            opacity:      !validation.isValid ? 0.45 : 1,
            boxShadow:    validation.isValid && !isCreated
              ? "0 4px 18px rgba(5,150,105,0.28), 0 0 0 1px rgba(52,211,153,0.10)"
              : "none",
            border:       validation.isValid && !isCreated ? "none" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {isCreated ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M2.5 8l4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Pool created successfully
            </>
          ) : validation.isValid ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.9}>
                <path d="M7 1.5v11M1.5 7h11" strokeLinecap="round" />
              </svg>
              Create pool
            </>
          ) : (
            "Fix constraints to create pool"
          )}
        </motion.button>

        {(isCreated || pooling.members.length > 2) && (
          <motion.button
            whileHover={{ background: "rgba(255,255,255,0.09)", color: "#f1f5f9" }}
            whileTap={{ scale: 0.96 }}
            onClick={reset}
            className="px-5 py-3.5 rounded-[14px] text-[12.5px] font-[500] transition-all duration-140 border"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.09)",
              color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            Reset
          </motion.button>
        )}
      </div>

      {/* Allocation result */}
      <AnimatePresence>
        {allocationResult && (
          <AllocationResult result={allocationResult} />
        )}
      </AnimatePresence>

      {/* Article 21 constraint reminder */}
      {!validation.isValid && validation.errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[12px] text-slate-500 leading-relaxed px-1"
        >
          {validation.errors.includes("COLLECTIVE_DEFICIT") && (
            <p>
              <span className="text-rose-400 font-[500]">Article 21 constraint: </span>
              The sum of all adjusted CBs must be ≥ 0. Add a surplus ship or remove a deficit ship.
            </p>
          )}
          {validation.errors.includes("TOO_FEW_MEMBERS") && (
            <p className="mt-1">
              <span className="text-amber-400 font-[500]">Minimum 2 members: </span>
              A pool must contain at least two ships.
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
