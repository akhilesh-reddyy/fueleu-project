import { AnimatePresence, motion } from "framer-motion";
import { useCompare }              from "./useCompare";
import { CompareChart }            from "./CompareChart";
import { FUEL_EU }                 from "@/core/domain/domain";
import type { RouteDTO }           from "@/core/application/application";
import type { CompareMetrics }     from "./useCompare";

// ─── Seed data (replace with shared route store / API hook) ──────────────────

const SEED_ROUTES: RouteDTO[] = [
  { routeId:"R001", vesselType:"Container",   fuelType:"HFO", year:2024, ghgIntensity:91.0, fuelConsumption:5000, distance:12000, totalEmissions:4500, isBaseline:true,  isCompliant:false, energyInScopeMJ:5000*41000 },
  { routeId:"R002", vesselType:"BulkCarrier", fuelType:"LNG", year:2024, ghgIntensity:88.0, fuelConsumption:4800, distance:11500, totalEmissions:4200, isBaseline:false, isCompliant:true,  energyInScopeMJ:4800*41000 },
  { routeId:"R003", vesselType:"Tanker",      fuelType:"MGO", year:2024, ghgIntensity:93.5, fuelConsumption:5100, distance:12500, totalEmissions:4700, isBaseline:false, isCompliant:false, energyInScopeMJ:5100*41000 },
  { routeId:"R004", vesselType:"RoRo",        fuelType:"HFO", year:2025, ghgIntensity:89.2, fuelConsumption:4900, distance:11800, totalEmissions:4300, isBaseline:false, isCompliant:true,  energyInScopeMJ:4900*41000 },
  { routeId:"R005", vesselType:"Container",   fuelType:"LNG", year:2025, ghgIntensity:90.5, fuelConsumption:4950, distance:11900, totalEmissions:4400, isBaseline:false, isCompliant:false, energyInScopeMJ:4950*41000 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, variant }: { children: React.ReactNode; variant: "green" | "red" | "amber" | "indigo" | "gray" }) {
  const s: Record<string, string> = {
    green:  "bg-emerald-900/55 text-emerald-300 border-emerald-500/[0.14]",
    red:    "bg-rose-900/50    text-rose-300    border-rose-500/[0.14]",
    amber:  "bg-amber-900/50   text-amber-300   border-amber-500/[0.14]",
    indigo: "bg-indigo-900/55  text-indigo-300  border-indigo-500/[0.15]",
    gray:   "bg-slate-800      text-slate-400   border-slate-700/50",
  };
  return (
    <span className={`inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[11px] font-[500] border ${s[variant]}`}>
      <span className="w-[4.5px] h-[4.5px] rounded-full" style={{ background: "currentColor", opacity: 0.72 }} />
      {children}
    </span>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-none">
      <span className="text-[11.5px] text-slate-500">{label}</span>
      <div className="text-right">
        <span className="text-[12.5px] font-[600] text-slate-200 tabular-nums" style={{ fontFamily: "'SF Mono','Fira Code',ui-monospace,monospace" }}>
          {value}
        </span>
        {sub && <span className="text-[10.5px] text-slate-600 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function GhgBar({ ghg }: { ghg: number }) {
  const lo = 86, hi = 96;
  const pct   = Math.min(100, Math.max(2, ((ghg - lo) / (hi - lo)) * 100));
  const tPct  = Math.min(100, ((FUEL_EU.TARGET_GHG_INTENSITY - lo) / (hi - lo)) * 100);
  const color = ghg <= FUEL_EU.TARGET_GHG_INTENSITY ? "#059669" : ghg < 91.5 ? "#b45309" : "#be123c";

  return (
    <div className="relative w-full h-[6px] rounded-full overflow-hidden mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        className="absolute left-0 top-0 bottom-0 rounded-full"
        style={{ background: color, opacity: 0.68 }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Target marker */}
      <div
        className="absolute top-0 bottom-0 w-[1.5px] bg-white/30 rounded-full"
        style={{ left: `${tPct}%` }}
      />
    </div>
  );
}

function RouteSelector({
  label, value, routes, onChange, accent,
}: {
  label:    string;
  value:    string;
  routes:   RouteDTO[];
  onChange: (id: string) => void;
  accent:   "green" | "rose";
}) {
  const accentStyles = {
    green: { border: "1px solid rgba(52,211,153,0.22)", shadow: "0 0 0 1px rgba(52,211,153,0.07), 0 8px 32px rgba(0,0,0,0.28)" },
    rose:  { border: "1px solid rgba(251,113,133,0.17)", shadow: "0 0 0 1px rgba(251,113,133,0.05), 0 8px 32px rgba(0,0,0,0.28)" },
  };

  return (
    <div
      className="relative overflow-hidden rounded-[16px] p-5"
      style={{
        background:  "linear-gradient(145deg, rgba(16,21,32,0.90), rgba(12,16,24,0.96))",
        ...accentStyles[accent],
        boxShadow: accentStyles[accent].shadow,
      }}
    >
      {/* Top highlight */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
      <p className="text-[10px] font-[600] uppercase tracking-[0.1em] text-slate-500 mb-3">{label}</p>
      <select
        className="w-full rounded-[9px] px-3 py-2 text-[13px] text-slate-100 outline-none cursor-pointer transition-all duration-150 border"
        style={{
          background:   "rgba(255,255,255,0.04)",
          borderColor:  "rgba(255,255,255,0.10)",
          fontFamily:   "'Inter', sans-serif",
          appearance:   "none",
          WebkitAppearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat:   "no-repeat",
          backgroundPosition: "right 10px center",
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {routes.map(r => (
          <option key={r.routeId} value={r.routeId}>
            {r.routeId} — {r.vesselType} / {r.fuelType} / {r.year}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Delta hero ───────────────────────────────────────────────────────────────

function DeltaHero({ percentDiff, winner, routeAId, routeBId, compA, compB }: {
  percentDiff: number;
  winner:      "A" | "B" | "equal";
  routeAId:    string;
  routeBId:    string;
  compA:       boolean;
  compB:       boolean;
}) {
  const isEqual = winner === "equal";
  const color   = isEqual ? "#a78bfa" : winner === "B" ? "#34d399" : "#fb7185";
  const orb     = isEqual ? "#7c3aed" : winner === "B" ? "#059669" : "#be123c";
  const sign    = percentDiff > 0 ? "+" : "";
  const label   = isEqual
    ? "Routes are identical"
    : winner === "B"
      ? `Route B is ${Math.abs(percentDiff).toFixed(2)}% more GHG-efficient than Route A`
      : `Route B is ${Math.abs(percentDiff).toFixed(2)}% less GHG-efficient than Route A`;

  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-8 text-center border border-white/[0.056]"
      style={{ background: "linear-gradient(145deg, rgba(16,21,32,0.88), rgba(12,16,24,0.96))" }}
    >
      {/* Top highlight */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
      {/* Ambient orb */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -top-10 pointer-events-none rounded-full"
        style={{ width: 240, height: 160, background: orb, filter: "blur(55px)", opacity: 0.2, transition: "background 0.5s" }}
      />

      {/* Big number */}
      <AnimatePresence mode="wait">
        <motion.p
          key={percentDiff.toFixed(4)}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="text-[64px] font-[700] leading-none mb-2 relative"
          style={{ letterSpacing: "-0.06em", color }}
        >
          {isEqual ? "0.00%" : `${sign}${percentDiff.toFixed(2)}%`}
        </motion.p>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.p
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="text-[13px] text-slate-500 mb-6 relative"
        >
          {label}
        </motion.p>
      </AnimatePresence>

      {/* Badges */}
      <div className="flex justify-center gap-3 relative">
        <Badge variant={compA ? "green" : "red"}>{compA ? "A: Compliant" : "A: Non-compliant"}</Badge>
        <Badge variant={compB ? "green" : "red"}>{compB ? "B: Compliant" : "B: Non-compliant"}</Badge>
      </div>
    </div>
  );
}

// ─── Split card ───────────────────────────────────────────────────────────────

function SplitCard({
  route, metrics, isWinner, side,
}: {
  route:   RouteDTO;
  metrics: CompareMetrics;
  isWinner: boolean;
  side:    "A" | "B";
}) {
  const M = (n: number) => (n / 1e6).toFixed(1) + "M";
  const N = (n: number) => n.toLocaleString("en-US");
  const mono = "'SF Mono','Fira Code',ui-monospace,monospace";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[16px] border"
      style={{
        background: "linear-gradient(145deg, rgba(16,21,32,0.88), rgba(12,16,24,0.96))",
        borderColor: isWinner ? "rgba(52,211,153,0.20)" : "rgba(255,255,255,0.056)",
        boxShadow: isWinner ? "0 0 0 1px rgba(52,211,153,0.06), 0 6px 28px rgba(0,0,0,0.25)" : "none",
      }}
    >
      {/* Top highlight */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />

      <div className="p-5 pb-3 border-b border-white/[0.056]" style={{ background: "rgba(0,0,0,0.14)" }}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-[12px] font-[600] text-indigo-400 mb-0.5" style={{ fontFamily: mono, letterSpacing: "0.04em" }}>
              {route.routeId}
              <span className="ml-2 text-[10px] font-[600] text-slate-500 tracking-[0.08em] uppercase" style={{ fontFamily: "'Inter',sans-serif" }}>
                Route {side}
              </span>
            </p>
            <p className="text-[11.5px] text-slate-500">{route.vesselType} · {route.fuelType} · {route.year}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {isWinner && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[10.5px] font-[600] bg-emerald-900/55 text-emerald-300 border border-emerald-500/[0.14]">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2.5 4-4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Lower GHG
              </span>
            )}
            <Badge variant={route.isCompliant ? "green" : "red"}>
              {route.isCompliant ? "Compliant" : "Non-compliant"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-5 py-3">
        {/* GHG with bar */}
        <div className="py-2.5 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11.5px] text-slate-500">GHG intensity</span>
            <span className="text-[12.5px] font-[600]" style={{
              fontFamily: mono,
              color: metrics.ghgIntensity <= FUEL_EU.TARGET_GHG_INTENSITY ? "#34d399"
                   : metrics.ghgIntensity < 91.5 ? "#fbbf24" : "#fb7185",
            }}>
              {metrics.ghgIntensity.toFixed(4)}
              <span className="text-[10.5px] text-slate-600 ml-1">gCO₂e/MJ</span>
            </span>
          </div>
          <GhgBar ghg={metrics.ghgIntensity} />
        </div>

        <MetricRow
          label="Compliance balance"
          value={<span style={{ color: metrics.complianceBalance > 0 ? "#34d399" : "#fb7185" }}>
            {metrics.complianceBalance > 0 ? "+" : ""}{M(metrics.complianceBalance)}
          </span>}
          sub="gCO₂e"
        />
        <MetricRow label="Fuel consumption" value={N(route.fuelConsumption)} sub="t" />
        <MetricRow label="Distance"          value={N(route.distance)}        sub="km" />
        <MetricRow label="Total emissions"   value={N(route.totalEmissions)}  sub="t" />
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ComparePage() {
  const { routes, selectedA, selectedB, result, selectA, selectB, swapRoutes } =
    useCompare(SEED_ROUTES);

  return (
    <div className="space-y-5">

      {/* Route selectors */}
      <div className="grid items-center gap-4" style={{ gridTemplateColumns: "1fr 52px 1fr" }}>
        <RouteSelector label="Route A — reference" value={selectedA} routes={routes} onChange={selectA} accent="green" />

        {/* VS / swap button */}
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={swapRoutes}
            className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border transition-all duration-150"
            style={{
              background:   "linear-gradient(145deg, rgba(79,70,229,0.18), rgba(124,58,237,0.12))",
              borderColor:  "rgba(99,102,241,0.24)",
              boxShadow:    "0 2px 12px rgba(79,70,229,0.15)",
              color:        "#818cf8",
              fontSize:     12,
              fontWeight:   700,
              letterSpacing: "0.06em",
            }}
            title="Swap routes"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M5 3l-3 3 3 3M11 13l3-3-3-3M2 6h12M2 10h12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>

        <RouteSelector label="Route B — compare" value={selectedB} routes={routes} onChange={selectB} accent="rose" />
      </div>

      {/* Delta hero */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={`hero-${result.routeA.routeId}-${result.routeB.routeId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <DeltaHero
              percentDiff={result.percentDiff}
              winner={result.winner}
              routeAId={result.routeA.routeId}
              routeBId={result.routeB.routeId}
              compA={result.metricsA.isCompliant}
              compB={result.metricsB.isCompliant}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split cards */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={`split-${result.routeA.routeId}-${result.routeB.routeId}`}
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SplitCard
              route={result.routeA}
              metrics={result.metricsA}
              isWinner={result.winner === "A"}
              side="A"
            />
            <SplitCard
              route={result.routeB}
              metrics={result.metricsB}
              isWinner={result.winner === "B"}
              side="B"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart */}
      {result && <CompareChart result={result} />}

      {/* Compliance insight */}
      {result && !result.isSameRoute && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.24 }}
          className="rounded-[14px] p-4 px-5 border text-[12.5px] text-slate-400 leading-relaxed"
          style={{
            background:   result.winner === "B" ? "rgba(5,150,105,0.07)" : "rgba(190,18,60,0.06)",
            borderColor:  result.winner === "B" ? "rgba(52,211,153,0.15)" : "rgba(251,113,133,0.13)",
          }}
        >
          <span className="font-[500] mr-1" style={{ color: result.winner === "B" ? "#34d399" : "#fb7185" }}>
            {result.winner === "B" ? "Route B outperforms" : "Route A outperforms"}
          </span>
          by {Math.abs(result.absoluteDiff).toFixed(4)} gCO₂e/MJ absolute difference.
          The CB delta is{" "}
          <span className="font-[500]" style={{ fontFamily: "'SF Mono','Fira Code',monospace" }}>
            {result.cbDiff > 0 ? "+" : ""}{(result.cbDiff / 1e6).toFixed(1)}M gCO₂e
          </span>
          {" "}in favour of{" "}
          <span className="font-[500] text-slate-300">Route {result.winner}</span>.
        </motion.div>
      )}
    </div>
  );
}
