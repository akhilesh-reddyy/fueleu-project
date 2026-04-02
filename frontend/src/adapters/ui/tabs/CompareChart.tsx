import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, type TooltipProps,
} from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo }                  from "react";
import { FUEL_EU }                  from "@/core/domain/domain";
import type { CompareResult }        from "./useCompare";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ghgColor(ghg: number): string {
  if (ghg <= FUEL_EU.TARGET_GHG_INTENSITY) return "#059669";
  if (ghg < 91.5)                          return "#b45309";
  return "#be123c";
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CompareTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background:   "rgba(16,21,32,0.96)",
        border:       "1px solid rgba(255,255,255,0.10)",
        borderRadius: 10,
        padding:      "10px 14px",
        boxShadow:    "0 8px 32px rgba(0,0,0,0.5)",
        fontFamily:   "'Inter', sans-serif",
        fontSize:     12,
        color:        "#f1f5f9",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 7, color: "#f1f5f9" }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: 2,
              background: p.fill as string,
              display: "inline-block", opacity: 0.85,
            }}
          />
          <span style={{ color: "#94a3b8" }}>{p.name}:&nbsp;</span>
          <span style={{ fontWeight: 600, color: p.fill as string, fontFamily: "'SF Mono','Fira Code',monospace" }}>
            {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CompareChartProps {
  result: CompareResult | null;
}

// ─── Chart data ───────────────────────────────────────────────────────────────

function buildChartData(result: CompareResult) {
  const { routeA: A, routeB: B, metricsA: mA, metricsB: mB } = result;

  return [
    {
      metric:  "GHG intensity",
      A:       +A.ghgIntensity.toFixed(4),
      B:       +B.ghgIntensity.toFixed(4),
      colorA:  ghgColor(A.ghgIntensity),
      colorB:  ghgColor(B.ghgIntensity),
      unit:    "gCO₂e/MJ",
    },
    {
      metric:  "CB (×10⁶)",
      A:       +Math.abs(mA.complianceBalance / 1e6).toFixed(1),
      B:       +Math.abs(mB.complianceBalance / 1e6).toFixed(1),
      colorA:  mA.complianceBalance > 0 ? "#059669" : "#be123c",
      colorB:  mB.complianceBalance > 0 ? "#059669" : "#be123c",
      unit:    "gCO₂e ×M",
    },
    {
      metric:  "Fuel (÷100)",
      A:       +(A.fuelConsumption / 100).toFixed(1),
      B:       +(B.fuelConsumption / 100).toFixed(1),
      colorA:  "#6366f1",
      colorB:  "#8b5cf6",
      unit:    "tonnes ÷100",
    },
    {
      metric:  "Distance (÷100)",
      A:       +(A.distance / 100).toFixed(1),
      B:       +(B.distance / 100).toFixed(1),
      colorA:  "#0369a1",
      colorB:  "#0ea5e9",
      unit:    "km ÷100",
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompareChart({ result }: CompareChartProps) {
  const data = useMemo(() => result ? buildChartData(result) : [], [result]);

  if (!result) return null;

  const { routeA: A, routeB: B } = result;
  const colA = ghgColor(A.ghgIntensity);
  const colB = ghgColor(B.ghgIntensity);

  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-white/[0.056]"
      style={{ background: "linear-gradient(145deg, rgba(16,21,32,0.88), rgba(12,16,24,0.96))" }}
    >
      {/* Top-edge light */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.056)", background: "rgba(0,0,0,0.16)" }}
      >
        <div>
          <h3 className="text-[13.5px] font-semibold tracking-[-0.022em] text-slate-100">
            GHG intensity comparison
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            Relative to FuelEU 2025 target ({FUEL_EU.TARGET_GHG_INTENSITY} gCO₂e/MJ)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 text-[11.5px] text-slate-400">
          {[
            { label: A.routeId, color: colA },
            { label: B.routeId, color: colB },
            { label: "Target",  color: "rgba(245,158,11,0.7)", dashed: true },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              {l.dashed
                ? <span style={{ width: 16, height: 1.5, background: l.color, borderTop: "2px dashed " + l.color, display: "inline-block" }} />
                : <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, opacity: 0.82, display: "inline-block" }} />
              }
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={A.routeId + B.routeId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="px-3 pt-3 pb-1"
          style={{ height: 240 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }} barCategoryGap="32%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.048)"
                vertical={false}
              />
              <XAxis
                dataKey="metric"
                tick={{ fill: "#475569", fontSize: 11, fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 11, fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                content={<CompareTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.028)" }}
              />

              {/* Route A bars */}
              <Bar
                dataKey="A"
                name={A.routeId}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={550}
                animationEasing="ease-out"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.colorA} opacity={0.78} />
                ))}
              </Bar>

              {/* Route B bars */}
              <Bar
                dataKey="B"
                name={B.routeId}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={550}
                animationEasing="ease-out"
                animationBegin={80}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.colorB} opacity={0.78} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>

      {/* Footnote */}
      <div
        className="px-6 pb-4 flex items-center gap-4 text-[11px] text-slate-600"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10, marginTop: -4 }}
      >
        <span>CB values shown as absolute magnitude</span>
        <span>·</span>
        <span>Fuel and distance divided by 100 for scale</span>
      </div>
    </div>
  );
}
