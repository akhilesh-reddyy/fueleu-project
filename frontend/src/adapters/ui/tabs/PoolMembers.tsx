import { AnimatePresence, motion } from "framer-motion";
import { useState }                 from "react";
import { FUEL_EU }                  from "@/core/domain/domain";
import type { PoolMember, AllocationResult } from "./usePooling";
import type { RouteDTO }            from "@/core/application/application";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mono = "'SF Mono','Fira Code',ui-monospace,monospace";

function cbColor(n: number): string {
  return n > 0 ? "#34d399" : n < 0 ? "#fb7185" : "#94a3b8";
}

function ghgColor(g: number): string {
  return g <= FUEL_EU.TARGET_GHG_INTENSITY ? "#34d399" : g < 91.5 ? "#fbbf24" : "#fb7185";
}

function formatM(n: number, signed = true): string {
  const abs = (Math.abs(n) / 1e6).toFixed(2) + "M";
  if (!signed) return abs;
  return (n >= 0 ? "+" : "−") + abs;
}

function FuelBadge({ fuel }: { fuel: string }) {
  const styles: Record<string, string> = {
    LNG: "bg-emerald-900/55 text-emerald-300 border-emerald-500/[0.14]",
    HFO: "bg-amber-900/50   text-amber-300   border-amber-500/[0.14]",
    MGO: "bg-rose-900/50    text-rose-300    border-rose-500/[0.14]",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-[2.5px] rounded-full text-[10px] font-[500] border ${styles[fuel] ?? styles.MGO}`}>
      {fuel}
    </span>
  );
}

// ─── GHG Bar ──────────────────────────────────────────────────────────────────

function GhgMiniBar({ ghg }: { ghg: number }) {
  const lo = 86.5, hi = 95;
  const pct  = Math.min(100, Math.max(2, ((ghg - lo) / (hi - lo)) * 100));
  const tPct = Math.min(100, ((FUEL_EU.TARGET_GHG_INTENSITY - lo) / (hi - lo)) * 100);
  const col  = ghgColor(ghg);

  return (
    <div className="relative w-full h-[4px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        className="absolute left-0 top-0 bottom-0 rounded-full"
        style={{ background: col, opacity: 0.65 }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
      <div className="absolute top-0 bottom-0 w-[1.5px] bg-white/[0.22] rounded-full" style={{ left: `${tPct}%` }} />
    </div>
  );
}

// ─── Single member card ───────────────────────────────────────────────────────

interface MemberCardProps {
  member:     PoolMember;
  alloc:      AllocationResult | undefined;
  canRemove:  boolean;
  onRemove:   () => void;
}

function MemberCard({ member: m, alloc, canRemove, onRemove }: MemberCardProps) {
  const isSurplus = m.cbBefore > 0;
  const isDeficit = m.cbBefore < 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1,    y: 0 }}
      exit={{ opacity: 0, scale: 0.94,    y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      whileHover={{ y: -1.5, transition: { type: "spring", stiffness: 340, damping: 22 } }}
      className="relative overflow-hidden rounded-[16px] border transition-colors duration-200"
      style={{
        background:  "linear-gradient(145deg, rgba(16,21,32,0.88), rgba(12,16,24,0.96))",
        borderColor: isSurplus ? "rgba(52,211,153,0.15)"
                    : isDeficit ? "rgba(251,113,133,0.12)"
                    : "rgba(255,255,255,0.056)",
        boxShadow:   isSurplus ? "0 0 20px rgba(5,150,105,0.07)"
                    : isDeficit ? "0 0 20px rgba(190,18,60,0.07)"
                    : "none",
        padding: "18px 20px",
        cursor: "default",
      }}
    >
      {/* Top highlight */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5">
          {/* Icon */}
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{
              background: isSurplus ? "rgba(5,150,105,0.13)" : "rgba(190,18,60,0.11)",
              border:     `1px solid ${isSurplus ? "rgba(52,211,153,0.15)" : "rgba(251,113,133,0.13)"}`,
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke={isSurplus ? "#34d399" : "#fb7185"} strokeWidth={1.65} className="w-[14px] h-[14px]">
              <path d="M3 10.5L8 3.5l5 7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 13.5h13" strokeLinecap="round" />
            </svg>
          </div>

          <div>
            <p className="text-[11.5px] font-[600] text-indigo-400" style={{ fontFamily: mono, letterSpacing: "0.03em" }}>
              {m.shipId}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">{m.vesselType} · {m.fuelType}</p>
          </div>
        </div>

        {/* Remove button */}
        {canRemove && (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={onRemove}
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center flex-shrink-0 text-[12px] transition-all duration-130 border"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", color: "#475569" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(251,113,133,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,113,133,0.22)"; (e.currentTarget as HTMLElement).style.color = "#fb7185"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLElement).style.color = "#475569"; }}
          >
            ✕
          </motion.button>
        )}
      </div>

      {/* CB number */}
      <div className="mb-1">
        <p className="text-[9.5px] font-[500] uppercase tracking-[0.1em] text-slate-500 mb-1.5">
          Compliance balance
        </p>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[22px] font-[700] leading-none"
            style={{ letterSpacing: "-0.045em", color: cbColor(m.cbBefore), fontFamily: mono }}
          >
            {formatM(m.cbBefore)}
          </span>
          <span className="text-[10px] text-slate-600">gCO₂e</span>
        </div>
      </div>

      {/* GHG bar */}
      <div className="mb-3">
        <GhgMiniBar ghg={m.ghgIntensity} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FuelBadge fuel={m.fuelType} />
          <span className="text-[10px] text-slate-600" style={{ fontFamily: mono }}>
            {m.ghgIntensity.toFixed(1)} gCO₂e/MJ
          </span>
        </div>

        {/* Allocation result — shown after pool is created */}
        <AnimatePresence>
          {alloc && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 text-[10.5px]"
              style={{ fontFamily: mono }}
            >
              <span className="text-slate-600">→</span>
              <span
                className="font-[600]"
                style={{ color: alloc.cbAfter >= 0 ? "#34d399" : "#fb7185" }}
              >
                {formatM(alloc.cbAfter)}
              </span>
              {alloc.transfer !== 0 && (
                <span style={{ color: alloc.transfer > 0 ? "#34d399" : "#fb7185", fontSize: 10 }}>
                  ({alloc.transfer > 0 ? "+" : "−"}{(Math.abs(alloc.transfer) / 1e6).toFixed(2)}M)
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!alloc && (
          <span className="text-[10.5px]" style={{ color: isSurplus ? "#34d399" : isDeficit ? "#fb7185" : "#94a3b8" }}>
            {isSurplus ? "Surplus" : isDeficit ? "Deficit" : "Neutral"}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Add member dropdown ──────────────────────────────────────────────────────

function AddMemberDropdown({
  routes, onAdd,
}: { routes: RouteDTO[]; onAdd: (r: RouteDTO) => void }) {
  const [open, setOpen] = useState(false);

  if (routes.length === 0) return null;

  return (
    <div className="relative">
      <motion.button
        whileHover={{ borderColor: "rgba(99,102,241,0.35)", color: "#818cf8" }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(p => !p)}
        className="w-full rounded-[16px] border border-dashed transition-colors duration-150 flex items-center justify-center gap-2.5 text-[12.5px] font-[500]"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.10)",
          color: "#475569",
          padding: "18px 20px",
          cursor: "pointer",
        }}
      >
        <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path d="M8 2v12M2 8h12" strokeLinecap="round" />
        </svg>
        Add ship to pool
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 right-0 mt-2 rounded-[12px] border border-white/[0.10] overflow-hidden z-20"
            style={{ background: "rgba(16,21,32,0.97)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}
          >
            {routes.map(r => {
              const cbVal = (FUEL_EU.TARGET_GHG_INTENSITY - r.ghgIntensity) * r.fuelConsumption * FUEL_EU.LHV_MJ_PER_TONNE;
              return (
                <motion.div
                  key={r.routeId}
                  whileHover={{ background: "rgba(255,255,255,0.035)" }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-white/[0.04] last:border-none"
                  onClick={() => { onAdd(r); setOpen(false); }}
                >
                  <span className="text-[11.5px] font-[600] text-indigo-400 flex-shrink-0 w-[50px]" style={{ fontFamily: mono }}>{r.routeId}</span>
                  <span className="text-[12px] text-slate-300 flex-1">{r.vesselType} · {r.fuelType}</span>
                  <span className="text-[11.5px] font-[600]" style={{ color: cbColor(cbVal), fontFamily: mono }}>
                    {cbVal > 0 ? "+" : "−"}{(Math.abs(cbVal) / 1e6).toFixed(2)}M
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

// ─── Pool members component ───────────────────────────────────────────────────

interface PoolMembersProps {
  members:          ReturnType<typeof import("./usePooling").usePooling>["members"];
  availableRoutes:  RouteDTO[];
  allocationResult: ReturnType<typeof import("./usePooling").usePooling>["allocationResult"];
  onAdd:            (r: RouteDTO) => void;
  onRemove:         (shipId: string) => void;
}

export function PoolMembers({
  members,
  availableRoutes,
  allocationResult,
  onAdd,
  onRemove,
}: PoolMembersProps) {
  const allocMap = new Map(allocationResult?.map(r => [r.shipId, r]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13.5px] font-[600] tracking-[-0.02em] text-slate-100">Pool members</h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            {members.length} ships · Article 21 greedy allocation
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {members.map(m => (
            <MemberCard
              key={m.shipId}
              member={m}
              alloc={allocMap.get(m.shipId)}
              canRemove={members.length > 2}
              onRemove={() => onRemove(m.shipId)}
            />
          ))}
        </AnimatePresence>

        {/* Add member */}
        {availableRoutes.length > 0 && (
          <AddMemberDropdown routes={availableRoutes} onAdd={onAdd} />
        )}
      </div>
    </div>
  );
}
