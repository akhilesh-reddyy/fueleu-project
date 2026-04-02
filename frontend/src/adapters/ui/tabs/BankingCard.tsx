import { motion, AnimatePresence } from "framer-motion";
import type { BankingState }        from "./useBanking";
import type { RouteDTO }            from "@/core/application/application";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankingCardProps {
  route:  RouteDTO | undefined;
  state:  BankingState;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mono = "'SF Mono','Fira Code',ui-monospace,monospace";

function formatM(n: number, signed = true): string {
  const abs   = Math.abs(n / 1e6).toFixed(2) + "M";
  if (!signed) return abs;
  return (n >= 0 ? "+" : "−") + abs;
}

function formatM1(n: number): string {
  return (Math.abs(n) / 1e6).toFixed(1) + "M";
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({
  label, value, sub, subColor,
}: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div
      className="px-4 py-3.5 transition-colors duration-120 group"
      style={{ background: "rgba(0,0,0,0.26)" }}
    >
      <p className="text-[10px] font-[500] uppercase tracking-[0.1em] text-slate-500 mb-1.5">
        {label}
      </p>
      <p
        className="text-[15px] font-[700] tracking-[-0.03em] leading-tight"
        style={{ fontFamily: mono }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10.5px] mt-0.5" style={{ color: subColor ?? "#475569" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BankingCard({ route, state }: BankingCardProps) {
  if (!route) return null;

  const { cbGco2eq, isSurplus, bankBalanceGco2eq, energyInScopeMJ } = state;

  const valueColor = isSurplus ? "#34d399" : state.isDeficit ? "#fb7185" : "#94a3b8";
  const orbColor   = isSurplus ? "#059669"  : state.isDeficit ? "#be123c"  : "#4f46e5";

  const ghgColor =
    route.ghgIntensity <= 89.3368 ? "#34d399"  :
    route.ghgIntensity <  91.5    ? "#fbbf24"  : "#fb7185";

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-white/[0.056]"
      style={{
        background: "linear-gradient(160deg, rgba(16,21,32,0.92) 0%, rgba(10,14,22,0.97) 100%)",
        boxShadow:  "0 1px 2px rgba(0,0,0,0.45), 0 8px 32px rgba(0,0,0,0.28)",
      }}
    >
      {/* Top-edge highlight */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)" }}
      />

      {/* Ambient orbs — color-shift on state change */}
      <AnimatePresence>
        <motion.div
          key={`orb-${route.routeId}`}
          aria-hidden
          className="absolute -top-14 -right-10 rounded-full pointer-events-none"
          style={{ width: 320, height: 220, background: orbColor, filter: "blur(64px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.17 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>
      <div
        aria-hidden
        className="absolute -bottom-14 -left-8 rounded-full pointer-events-none"
        style={{ width: 200, height: 200, background: orbColor, filter: "blur(55px)", opacity: 0.09 }}
      />

      {/* Card header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-6 relative">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 transition-all duration-300"
            style={{
              background:  isSurplus ? "rgba(5,150,105,0.14)" : "rgba(190,18,60,0.12)",
              border:      `1px solid ${isSurplus ? "rgba(52,211,153,0.18)" : "rgba(251,113,133,0.15)"}`,
              boxShadow:   `0 0 16px ${orbColor}22`,
            }}
          >
            <svg
              viewBox="0 0 20 20" fill="none"
              stroke={isSurplus ? "#34d399" : "#fb7185"}
              strokeWidth={1.7}
              className="w-[18px] h-[18px]"
            >
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 7v3l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <p className="text-[13px] font-[500] text-slate-300">
              {route.vesselType} · {route.fuelType} · {route.year}
            </p>
            <p className="text-[10.5px] text-slate-500 mt-0.5" style={{ fontFamily: mono }}>
              {route.routeId} · IMO compliance account
            </p>
          </div>
        </div>

        {/* Live badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{
            background: "rgba(5,150,105,0.09)",
            border:     "1px solid rgba(5,150,105,0.18)",
          }}
        >
          <span
            className="w-[6px] h-[6px] rounded-full"
            style={{ background: "#34d399", boxShadow: "0 0 0 2.5px rgba(52,211,153,0.22), 0 0 8px rgba(52,211,153,0.6)", animation: "pulse 2s ease-in-out infinite" }}
          />
          <span className="text-[10.5px] font-[600] tracking-[0.04em] text-emerald-400">Live</span>
        </div>
      </div>

      {/* Main CB number */}
      <div className="px-8 pb-6 relative">
        <p className="text-[11px] font-[500] uppercase tracking-[0.1em] text-slate-500 mb-2.5">
          Compliance balance
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={`cb-${route.routeId}`}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="flex items-baseline gap-2"
          >
            <span
              className="leading-none font-[700]"
              style={{ fontSize: 60, letterSpacing: "-0.06em", color: valueColor, fontFamily: mono }}
            >
              {formatM(cbGco2eq)}
            </span>
            <span className="text-[16px] font-[500] text-slate-500 pb-1">gCO₂e</span>
          </motion.div>
        </AnimatePresence>

        {/* Compliance status pill */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`status-${isSurplus}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex items-center gap-2"
          >
            {isSurplus ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-[500]"
                style={{ background: "rgba(5,150,105,0.13)", color: "#34d399", border: "1px solid rgba(52,211,153,0.15)" }}
              >
                <span className="w-[5px] h-[5px] rounded-full bg-emerald-400" />
                Surplus · Bankable under Article 20
              </span>
            ) : state.isDeficit ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-[500]"
                style={{ background: "rgba(190,18,60,0.11)", color: "#fb7185", border: "1px solid rgba(251,113,133,0.13)" }}
              >
                <span className="w-[5px] h-[5px] rounded-full bg-rose-400" />
                Deficit · Requires remediation
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-[500]"
                style={{ background: "rgba(99,102,241,0.11)", color: "#a5b4fc", border: "1px solid rgba(165,180,252,0.12)" }}
              >
                <span className="w-[5px] h-[5px] rounded-full bg-indigo-400" />
                Exactly compliant
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stats strip */}
      <div
        className="grid grid-cols-3 divide-x relative"
        style={{
          borderTop:     "1px solid rgba(255,255,255,0.055)",
          divideColor:   "rgba(255,255,255,0.055)",
          background:    "rgba(0,0,0,0.22)",
        }}
      >
        <StatCell
          label="GHG intensity"
          value={route.ghgIntensity.toFixed(4)}
          sub={route.ghgIntensity <= 89.3368 ? "Below target ✓" : "Above target ✗"}
          subColor={ghgColor}
        />
        <StatCell
          label="Energy in scope"
          value={formatM1(energyInScopeMJ)}
          sub="MJ · LHV 41,000 MJ/t"
        />
        <StatCell
          label="Banked balance"
          value={bankBalanceGco2eq > 0 ? formatM1(bankBalanceGco2eq) : "—"}
          sub={bankBalanceGco2eq > 0 ? "gCO₂e available" : "No balance"}
          subColor={bankBalanceGco2eq > 0 ? "#34d399" : undefined}
        />
      </div>
    </div>
  );
}
