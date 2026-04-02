import { useState, useMemo }          from "react";
import { AnimatePresence, motion }     from "framer-motion";
import { Card, KpiCard }               from "@/components/ui/Card";
import { Button }                      from "@/components/ui/Button";
import type { RouteDTO }               from "@/core/application/application";
import { FUEL_EU }                     from "@/core/domain/domain";

// ─── Seed data (replace with real API hook in production) ─────────────────────

const SEED_ROUTES: RouteDTO[] = [
  { routeId:"R001", vesselType:"Container",   fuelType:"HFO", year:2024, ghgIntensity:91.0, fuelConsumption:5000, distance:12000, totalEmissions:4500, isBaseline:true,  isCompliant:false, energyInScopeMJ:5000*41000 },
  { routeId:"R002", vesselType:"BulkCarrier", fuelType:"LNG", year:2024, ghgIntensity:88.0, fuelConsumption:4800, distance:11500, totalEmissions:4200, isBaseline:false, isCompliant:true,  energyInScopeMJ:4800*41000 },
  { routeId:"R003", vesselType:"Tanker",      fuelType:"MGO", year:2024, ghgIntensity:93.5, fuelConsumption:5100, distance:12500, totalEmissions:4700, isBaseline:false, isCompliant:false, energyInScopeMJ:5100*41000 },
  { routeId:"R004", vesselType:"RoRo",        fuelType:"HFO", year:2025, ghgIntensity:89.2, fuelConsumption:4900, distance:11800, totalEmissions:4300, isBaseline:false, isCompliant:true,  energyInScopeMJ:4900*41000 },
  { routeId:"R005", vesselType:"Container",   fuelType:"LNG", year:2025, ghgIntensity:90.5, fuelConsumption:4950, distance:11900, totalEmissions:4400, isBaseline:false, isCompliant:false, energyInScopeMJ:4950*41000 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, variant }: { children: React.ReactNode; variant: "green"|"red"|"amber"|"indigo" }) {
  const styles = {
    green:  "bg-emerald-900/55 text-emerald-300 border border-emerald-500/[0.14]",
    red:    "bg-rose-900/50    text-rose-300    border border-rose-500/[0.14]",
    amber:  "bg-amber-900/50   text-amber-300   border border-amber-500/[0.14]",
    indigo: "bg-indigo-900/55  text-indigo-300  border border-indigo-500/[0.15]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-[500] ${styles[variant]}`}>
      <span className="w-[5px] h-[5px] rounded-full" style={{ background: "currentColor", opacity: 0.7 }} />
      {children}
    </span>
  );
}

function Pill({ children, variant }: { children: React.ReactNode; variant: "green"|"red"|"amber"|"indigo" }) {
  const styles = {
    green:  "bg-emerald-900/55 text-emerald-300 border border-emerald-500/[0.14]",
    red:    "bg-rose-900/50    text-rose-300    border border-rose-500/[0.14]",
    amber:  "bg-amber-900/50   text-amber-300   border border-amber-500/[0.14]",
    indigo: "bg-indigo-900/55  text-indigo-300  border border-indigo-500/[0.14]",
  };
  return (
    <span className={`inline-block px-2 py-[2.5px] rounded-full text-[10.5px] font-[600] ${styles[variant]}`}>
      {children}
    </span>
  );
}

function GhgSpark({ ghg }: { ghg: number }) {
  const lo = 86.5, hi = 95;
  const pct  = Math.min(100, Math.max(3, ((ghg - lo) / (hi - lo)) * 100));
  const tPct = Math.min(100, ((FUEL_EU.TARGET_GHG_INTENSITY - lo) / (hi - lo)) * 100);
  const color = ghg <= FUEL_EU.TARGET_GHG_INTENSITY ? "#059669" : ghg < 91.5 ? "#b45309" : "#be123c";

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-[56px] h-[18px] rounded-[4px] overflow-hidden bg-white/[0.05] shrink-0">
        <motion.div
          className="absolute left-0 top-0 bottom-0 rounded-[4px]"
          style={{ background: color, opacity: 0.6 }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Target line */}
        <div
          className="absolute top-0 bottom-0 w-[1.5px] bg-white/[0.28] rounded-[1px]"
          style={{ left: `${tPct}%` }}
        />
      </div>
      <span
        className="text-[12.5px] font-[600] tabular-nums"
        style={{ color, fontFamily: "'SF Mono','Fira Code',ui-monospace,monospace" }}
      >
        {ghg.toFixed(4)}
      </span>
      <span className="text-[10.5px] text-slate-500">gCO₂e/MJ</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RoutesPage() {
  const [routes, setRoutes]     = useState<RouteDTO[]>(SEED_ROUTES);
  const [yearF,   setYearF]     = useState("all");
  const [vesselF, setVesselF]   = useState("all");
  const [fuelF,   setFuelF]     = useState("all");
  const [query,   setQuery]     = useState("");

  // ── Derived stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const surplus = routes
      .filter(r => (FUEL_EU.TARGET_GHG_INTENSITY - r.ghgIntensity) * r.energyInScopeMJ > 0)
      .reduce((s, r) => s + (FUEL_EU.TARGET_GHG_INTENSITY - r.ghgIntensity) * r.energyInScopeMJ, 0);
    const deficit = routes
      .filter(r => (FUEL_EU.TARGET_GHG_INTENSITY - r.ghgIntensity) * r.energyInScopeMJ < 0)
      .reduce((s, r) => s + (FUEL_EU.TARGET_GHG_INTENSITY - r.ghgIntensity) * r.energyInScopeMJ, 0);
    const avg = routes.reduce((s, r) => s + r.ghgIntensity, 0) / routes.length;
    const compliant = routes.filter(r => r.isCompliant).length;
    return { surplus, deficit, avg, compliant };
  }, [routes]);

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => routes.filter(r =>
    (yearF   === "all" || r.year.toString()   === yearF)   &&
    (vesselF === "all" || r.vesselType        === vesselF) &&
    (fuelF   === "all" || r.fuelType          === fuelF)   &&
    (!query || [r.routeId, r.vesselType, r.fuelType].some(s => s.toLowerCase().includes(query.toLowerCase())))
  ), [routes, yearF, vesselF, fuelF, query]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  function setBaseline(routeId: string) {
    setRoutes(prev => prev.map(r => ({ ...r, isBaseline: r.routeId === routeId })));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const M    = (n: number) => (n / 1e6).toFixed(1) + "M";
  const mono = "font-['SF_Mono','Fira_Code',ui-monospace,monospace]";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3.5">
        {[
          { label: "Total routes",   value: routes.length,          orb: "indigo" as const, pill: <Pill variant="green">{stats.compliant} compliant</Pill>,   sub: "across 2 years",     vc: "#f1f5f9" },
          { label: "Surplus CB",     value: "+" + M(stats.surplus), orb: "emerald" as const, pill: <Pill variant="green">gCO₂e</Pill>,                        sub: "Article 20 bankable", vc: "#34d399" },
          { label: "Deficit CB",     value: M(stats.deficit),       orb: "rose" as const,   pill: <Pill variant="red">gCO₂e</Pill>,                           sub: "requires remedy",    vc: "#fb7185" },
          { label: "Fleet avg. GHG", value: stats.avg.toFixed(2),   orb: "violet" as const,  pill: <Pill variant={stats.avg <= FUEL_EU.TARGET_GHG_INTENSITY ? "green" : "amber"}>{stats.avg <= FUEL_EU.TARGET_GHG_INTENSITY ? "Below" : "Above"} target</Pill>, sub: "gCO₂e/MJ", vc: "#a78bfa" },
        ].map(k => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            orb={k.orb}
            pill={k.pill}
            sub={k.sub}
            valueColor={k.vc}
          />
        ))}
      </div>

      {/* Table card */}
      <Card variant="solid" padding="none" className="overflow-hidden">

        {/* Table header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-white/[0.056]"
          style={{ background: "rgba(0,0,0,0.18)" }}
        >
          <div>
            <h3 className="text-[14px] font-semibold tracking-[-0.022em] text-slate-100">Route records</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">{filtered.length} of {routes.length} routes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm"
              iconLeft={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M2 12l4-4 3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            >
              Trend
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div
          className="flex items-center gap-2.5 px-6 py-3 border-b border-white/[0.056]"
          style={{ background: "rgba(0,0,0,0.10)" }}
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] border border-white/[0.10] bg-white/[0.04] flex-[0_0_195px] focus-within:border-indigo-500/45 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all duration-150">
            <svg className="w-[13px] h-[13px] text-slate-500 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
            </svg>
            <input
              className="bg-transparent border-none outline-none text-slate-100 text-[12.5px] w-full placeholder:text-slate-500"
              placeholder="Search routes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {/* Selects */}
          {[
            { id: "year",   value: yearF,   setter: setYearF,   opts: [["all","All years"],["2024","2024"],["2025","2025"]] },
            { id: "vessel", value: vesselF, setter: setVesselF, opts: [["all","All vessels"],["Container","Container"],["BulkCarrier","BulkCarrier"],["Tanker","Tanker"],["RoRo","RoRo"]] },
            { id: "fuel",   value: fuelF,   setter: setFuelF,   opts: [["all","All fuels"],["HFO","HFO"],["LNG","LNG"],["MGO","MGO"]] },
          ].map(s => (
            <select
              key={s.id}
              className="bg-white/[0.04] border border-white/[0.10] rounded-[8px] px-2.5 py-[5.5px] text-[12px] text-slate-300 outline-none cursor-pointer hover:border-white/[0.16] hover:text-slate-100 transition-colors duration-130"
              value={s.value}
              onChange={e => s.setter(e.target.value)}
            >
              {s.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}

          <span className="flex-1" />
          <span className="text-[11.5px] text-slate-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.14)" }}>
              {["Route","Vessel","Fuel","Year","GHG intensity","Consumption","CB balance","Status",""].map((h, i) => (
                <th
                  key={i}
                  className="px-3.5 py-2.5 text-[10.5px] font-[600] uppercase tracking-[0.08em] text-slate-500 text-left border-b border-white/[0.056]"
                  style={{ paddingLeft: i === 0 ? 24 : undefined, paddingRight: i === 8 ? 24 : undefined, textAlign: i === 8 ? "right" : "left" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-slate-500 text-[13px]">
                    No routes match the current filters
                  </td>
                </tr>
              ) : filtered.map((r, i) => {
                const cbVal = (FUEL_EU.TARGET_GHG_INTENSITY - r.ghgIntensity) * r.energyInScopeMJ;
                const fuelVariant = r.fuelType === "LNG" ? "green" : r.fuelType === "HFO" ? "amber" : "red";

                return (
                  <motion.tr
                    key={r.routeId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group border-b border-white/[0.038] hover:bg-white/[0.027] transition-colors duration-120"
                  >
                    <td className="px-6 py-3">
                      <span className={`${mono} text-[12px] font-[600] text-indigo-400 tracking-[0.02em]`}>
                        {r.routeId}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-[500] text-slate-100">{r.vesselType}</td>
                    <td className="px-3.5 py-3">
                      <Badge variant={fuelVariant}>{r.fuelType}</Badge>
                    </td>
                    <td className="px-3.5 py-3 text-slate-500">{r.year}</td>
                    <td className="px-3.5 py-3">
                      <GhgSpark ghg={r.ghgIntensity} />
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`${mono} text-[12px] text-slate-400`}>
                        {r.fuelConsumption.toLocaleString()} t
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`${mono} text-[13px] font-[700]`}
                          style={{ color: cbVal > 0 ? "#34d399" : "#fb7185" }}
                        >
                          {cbVal > 0 ? "+" : ""}{M(cbVal)}
                        </span>
                        <span className="text-[10.5px] text-slate-600">gCO₂e</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      {r.isBaseline
                        ? <Badge variant="indigo">Baseline</Badge>
                        : r.isCompliant
                          ? <Badge variant="green">Compliant</Badge>
                          : <Badge variant="red">Deficit</Badge>
                      }
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-140">
                        {r.isBaseline ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[7px] text-[11.5px] font-[500] text-indigo-400 bg-indigo-900/50 border border-indigo-500/24 cursor-default">
                            <svg className="w-[10px] h-[10px]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Active
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setBaseline(r.routeId)}
                          >
                            Set baseline
                          </Button>
                        )}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
