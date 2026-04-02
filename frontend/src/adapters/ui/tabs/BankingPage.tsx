import { useState, useCallback }    from "react";
import { AnimatePresence, motion }   from "framer-motion";
import { useBanking }                from "./useBanking";
import { BankingCard }               from "./BankingCard";
import type { Transaction }          from "./useBanking";
import type { RouteDTO }             from "@/core/application/application";

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_ROUTES: RouteDTO[] = [
  { routeId:"R001", vesselType:"Container",   fuelType:"HFO", year:2024, ghgIntensity:91.0, fuelConsumption:5000, distance:12000, totalEmissions:4500, isBaseline:true,  isCompliant:false, energyInScopeMJ:5000*41000 },
  { routeId:"R002", vesselType:"BulkCarrier", fuelType:"LNG", year:2024, ghgIntensity:88.0, fuelConsumption:4800, distance:11500, totalEmissions:4200, isBaseline:false, isCompliant:true,  energyInScopeMJ:4800*41000 },
  { routeId:"R003", vesselType:"Tanker",      fuelType:"MGO", year:2024, ghgIntensity:93.5, fuelConsumption:5100, distance:12500, totalEmissions:4700, isBaseline:false, isCompliant:false, energyInScopeMJ:5100*41000 },
  { routeId:"R004", vesselType:"RoRo",        fuelType:"HFO", year:2025, ghgIntensity:89.2, fuelConsumption:4900, distance:11800, totalEmissions:4300, isBaseline:false, isCompliant:true,  energyInScopeMJ:4900*41000 },
  { routeId:"R005", vesselType:"Container",   fuelType:"LNG", year:2025, ghgIntensity:90.5, fuelConsumption:4950, distance:11900, totalEmissions:4400, isBaseline:false, isCompliant:false, energyInScopeMJ:4950*41000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatM(n: number): string {
  return (Math.abs(n) / 1e6).toFixed(2) + "M";
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Transaction item ─────────────────────────────────────────────────────────

function TxItem({ tx }: { tx: Transaction }) {
  const isBanked = tx.type === "bank";
  const mono     = "'SF Mono','Fira Code',ui-monospace,monospace";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-4 px-6 py-3.5 transition-colors duration-120 border-b border-white/[0.038] last:border-none group"
      style={{ cursor: "default" }}
      whileHover={{ background: "rgba(255,255,255,0.024)" }}
    >
      {/* Icon */}
      <div
        className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0"
        style={{
          background: isBanked ? "rgba(5,150,105,0.13)"  : "rgba(79,70,229,0.13)",
          border:     isBanked ? "1px solid rgba(52,211,153,0.15)" : "1px solid rgba(165,180,252,0.13)",
        }}
      >
        {isBanked ? (
          <svg viewBox="0 0 16 16" fill="none" stroke="#34d399" strokeWidth={1.7} className="w-[15px] h-[15px]">
            <path d="M8 2v12M2 8h12" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" stroke="#a5b4fc" strokeWidth={1.7} className="w-[15px] h-[15px]">
            <rect x="1.5" y="6" width="13" height="8" rx="1.5" />
            <path d="M4.5 6V5a3.5 3.5 0 017 0v1" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-[500] text-slate-100 leading-tight">
          {isBanked ? "Surplus banked" : "Credits applied"} · {tx.routeId}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {tx.vesselType} · {tx.fuelType} · {formatDate(tx.timestamp)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p
          className="text-[13.5px] font-[700] leading-tight"
          style={{
            color:      isBanked ? "#34d399" : "#a5b4fc",
            fontFamily: mono,
            letterSpacing: "-0.02em",
          }}
        >
          {isBanked ? "+" : "−"}{formatM(tx.amountGco2eq)}
          <span className="text-[10.5px] text-slate-600 font-[400] ml-1">gCO₂e</span>
        </p>
        <div className="flex justify-end mt-1">
          <span
            className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[9.5px] font-[600]"
            style={{
              background: isBanked ? "rgba(5,150,105,0.12)" : "rgba(79,70,229,0.12)",
              color:      isBanked ? "#34d399" : "#a5b4fc",
              border:     isBanked ? "1px solid rgba(52,211,153,0.13)" : "1px solid rgba(165,180,252,0.12)",
            }}
          >
            {tx.status === "confirmed" ? "Banked" : "Applied"}
          </span>
        </div>
      </div>

      {/* Entry ID — revealed on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-140 text-[10px] text-slate-600 flex-shrink-0 text-right" style={{ fontFamily: mono }}>
        {tx.id}
      </div>
    </motion.div>
  );
}

// ─── Action drawer (modal-style form) ────────────────────────────────────────

type DrawerType = "bank" | "apply" | null;

interface ActionDrawerProps {
  type:      DrawerType;
  maxAmount: number;
  label:     string;
  onConfirm: (amount: number) => void;
  onClose:   () => void;
}

function ActionDrawer({ type, maxAmount, label, onConfirm, onClose }: ActionDrawerProps) {
  const [amount, setAmount] = useState<string>((maxAmount / 1e6).toFixed(2));
  const isBanking = type === "bank";

  function handleConfirm() {
    const val = parseFloat(amount) * 1e6;
    if (val <= 0 || val > maxAmount + 1) return;
    onConfirm(Math.min(val, maxAmount));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-[520px] rounded-t-[22px] border border-white/[0.07] border-b-0"
        style={{
          background: "linear-gradient(180deg, #0c1019 0%, #101520 100%)",
          padding: "28px 28px 40px",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.55)",
        }}
      >
        {/* Handle */}
        <div className="w-9 h-1 rounded-full bg-white/[0.10] mx-auto mb-5" />

        <h2 className="text-[17px] font-[600] tracking-[-0.025em] mb-1.5">
          {isBanking ? "Bank surplus CB" : "Apply banked credits"}
        </h2>
        <p className="text-[12.5px] text-slate-500 mb-6">
          {isBanking
            ? "Store compliance balance for future application · Article 20"
            : "Draw from your banked balance to offset a deficit · Article 20"
          }
        </p>

        {/* Amount input */}
        <div className="mb-4">
          <label className="block text-[11px] font-[500] uppercase tracking-[0.09em] text-slate-500 mb-2">
            Amount (gCO₂e × 10⁶)
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full rounded-[10px] px-4 py-3 text-[15px] font-[600] text-slate-100 outline-none transition-all duration-150 border"
            style={{
              background:  "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.10)",
              fontFamily:  "'SF Mono','Fira Code',monospace",
            }}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.45)", e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)")}
            onBlur={e =>  (e.target.style.borderColor = "rgba(255,255,255,0.10)", e.target.style.boxShadow = "none")}
          />
        </div>

        {/* Info strip */}
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-[10px] text-[12px] mb-6"
          style={{
            background:  isBanking ? "rgba(5,150,105,0.08)"  : "rgba(79,70,229,0.09)",
            border:      isBanking ? "1px solid rgba(52,211,153,0.14)" : "1px solid rgba(165,180,252,0.13)",
            color:       isBanking ? "#34d399" : "#a5b4fc",
          }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <circle cx="7" cy="7" r="6"/><path d="M7 5v4" strokeLinecap="round"/><circle cx="7" cy="10" r=".4" fill="currentColor"/>
          </svg>
          {label}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="flex-1 py-3 rounded-[11px] text-[13px] font-[600] transition-all duration-150 border"
            style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", borderColor: "rgba(255,255,255,0.09)" }}
            onClick={onClose}
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ y: -1, boxShadow: isBanking ? "0 6px 26px rgba(5,150,105,0.42)" : "0 6px 26px rgba(79,70,229,0.46)" }}
            whileTap={{ scale: 0.97 }}
            className="flex-1 py-3 rounded-[11px] text-[13px] font-[600] text-white transition-all duration-150"
            style={{
              background: isBanking
                ? "linear-gradient(135deg, #065f46, #059669)"
                : "linear-gradient(135deg, #4338ca, #7c3aed)",
              boxShadow: isBanking
                ? "0 4px 18px rgba(5,150,105,0.28)"
                : "0 4px 18px rgba(79,70,229,0.32)",
            }}
            onClick={handleConfirm}
          >
            {isBanking ? "Bank surplus" : "Apply credits"}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BankingPage() {
  const banking = useBanking(SEED_ROUTES);
  const { state, transactions, selectedRoute, selectedRouteId, routes, selectRoute, bankSurplus, applyBanked } = banking;

  const [drawer, setDrawer] = useState<DrawerType>(null);

  const handleConfirm = useCallback((amount: number) => {
    if (drawer === "bank")  bankSurplus(amount);
    if (drawer === "apply") applyBanked(amount);
    setDrawer(null);
  }, [drawer, bankSurplus, applyBanked]);

  const drawerLabel = drawer === "bank"
    ? `Available to bank: ${formatM(state.bankableAmount)} gCO₂e`
    : `Available balance: ${formatM(state.bankBalanceGco2eq)} gCO₂e`;

  const drawerMax = drawer === "bank" ? state.bankableAmount : state.applicableAmount;

  return (
    <>
      <div className="space-y-5">

        {/* Route selector */}
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-[500] uppercase tracking-[0.1em] text-slate-500 shrink-0">
            Account
          </label>
          <select
            className="rounded-[9px] px-3 py-2 text-[13px] text-slate-100 border outline-none cursor-pointer transition-all duration-140"
            style={{
              background:   "rgba(255,255,255,0.04)",
              borderColor:  "rgba(255,255,255,0.10)",
              fontFamily:   "'Inter',sans-serif",
              appearance:   "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              paddingRight: 30,
            }}
            value={selectedRouteId}
            onChange={e => selectRoute(e.target.value)}
          >
            {routes.map(r => (
              <option key={r.routeId} value={r.routeId}>
                {r.routeId} — {r.vesselType} / {r.fuelType} / {r.year}
              </option>
            ))}
          </select>
        </div>

        {/* Central balance card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedRouteId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <BankingCard route={selectedRoute} state={state} />
          </motion.div>
        </AnimatePresence>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-4">
          {/* Bank surplus */}
          <motion.button
            whileHover={state.canBank ? {
              y: -2,
              boxShadow: "0 8px 32px rgba(5,150,105,0.2), 0 0 0 1px rgba(52,211,153,0.1)",
            } : {}}
            whileTap={state.canBank ? { scale: 0.97 } : {}}
            disabled={!state.canBank}
            onClick={() => setDrawer("bank")}
            className="relative overflow-hidden rounded-[16px] p-5 text-left border transition-all duration-180"
            style={{
              background:   "linear-gradient(145deg, rgba(16,21,32,0.9), rgba(12,16,24,0.96))",
              borderColor:  state.canBank ? "rgba(52,211,153,0.20)" : "rgba(255,255,255,0.06)",
              cursor:       state.canBank ? "pointer" : "not-allowed",
              opacity:      state.canBank ? 1 : 0.38,
            }}
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />

            <div className="flex items-start justify-between gap-3">
              <div
                className="w-[42px] h-[42px] rounded-[12px] flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(5,150,105,0.14)", border: "1px solid rgba(52,211,153,0.16)" }}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="#34d399" strokeWidth={1.7} className="w-5 h-5">
                  <path d="M10 3v14M3 10h14" strokeLinecap="round" />
                </svg>
              </div>
              <svg className="w-4 h-4 text-slate-600 mt-1 transition-transform duration-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <p className="text-[14px] font-[600] tracking-[-0.018em] text-emerald-400 mt-3 mb-1">
              Bank surplus
            </p>
            <p className="text-[11.5px] text-slate-500 leading-snug">
              Store positive CB for future use · Article 20
            </p>
            {state.canBank && (
              <p className="text-[11px] text-emerald-500 mt-2" style={{ fontFamily: "'SF Mono','Fira Code',monospace" }}>
                +{formatM(state.bankableAmount)} gCO₂e available
              </p>
            )}
          </motion.button>

          {/* Apply credits */}
          <motion.button
            whileHover={state.canApply ? {
              y: -2,
              boxShadow: "0 8px 32px rgba(79,70,229,0.2), 0 0 0 1px rgba(129,140,248,0.1)",
            } : {}}
            whileTap={state.canApply ? { scale: 0.97 } : {}}
            disabled={!state.canApply}
            onClick={() => setDrawer("apply")}
            className="relative overflow-hidden rounded-[16px] p-5 text-left border transition-all duration-180"
            style={{
              background:  "linear-gradient(145deg, rgba(16,21,32,0.9), rgba(12,16,24,0.96))",
              borderColor: state.canApply ? "rgba(129,140,248,0.20)" : "rgba(255,255,255,0.06)",
              cursor:      state.canApply ? "pointer" : "not-allowed",
              opacity:     state.canApply ? 1 : 0.38,
            }}
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />

            <div className="flex items-start justify-between gap-3">
              <div
                className="w-[42px] h-[42px] rounded-[12px] flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(79,70,229,0.14)", border: "1px solid rgba(165,180,252,0.15)" }}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="#a5b4fc" strokeWidth={1.7} className="w-5 h-5">
                  <rect x="2" y="7" width="16" height="10" rx="2" />
                  <path d="M5 7V5.5a5 5 0 0110 0V7" strokeLinecap="round" />
                </svg>
              </div>
              <svg className="w-4 h-4 text-slate-600 mt-1" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <p className="text-[14px] font-[600] tracking-[-0.018em] text-indigo-300 mt-3 mb-1">
              Apply credits
            </p>
            <p className="text-[11.5px] text-slate-500 leading-snug">
              Offset a deficit using banked surplus · Article 20
            </p>
            {state.canApply && (
              <p className="text-[11px] text-indigo-400 mt-2" style={{ fontFamily: "'SF Mono','Fira Code',monospace" }}>
                {formatM(state.bankBalanceGco2eq)} gCO₂e available
              </p>
            )}
          </motion.button>
        </div>

        {/* Transaction history */}
        <div
          className="relative overflow-hidden rounded-[18px] border"
          style={{
            background:  "linear-gradient(145deg, rgba(16,21,32,0.88), rgba(12,16,24,0.96))",
            borderColor: "rgba(255,255,255,0.056)",
            boxShadow:   "0 1px 2px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.2)",
          }}
        >
          <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />

          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "rgba(255,255,255,0.055)", background: "rgba(0,0,0,0.17)" }}
          >
            <div>
              <h3 className="text-[13.5px] font-[600] tracking-[-0.02em] text-slate-100">
                Transaction history
              </h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                {transactions.length > 0
                  ? `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} · Balance ${formatM(state.bankBalanceGco2eq)} gCO₂e`
                  : "No transactions yet"
                }
              </p>
            </div>

            {transactions.length > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className="text-[11.5px] font-[600]"
                  style={{ fontFamily: "'SF Mono','Fira Code',monospace", color: "#34d399" }}
                >
                  {formatM(state.bankBalanceGco2eq)} gCO₂e
                </span>
              </div>
            )}
          </div>

          {/* List */}
          <div className="py-1.5">
            {transactions.length === 0 ? (
              <div className="py-14 text-center">
                <div className="text-[32px] mb-3 opacity-[0.18] select-none">◈</div>
                <p className="text-[13px] text-slate-500">No transactions yet</p>
                <p className="text-[12px] text-slate-600 mt-1">Bank surplus or apply credits to get started</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {transactions.map(tx => <TxItem key={tx.id} tx={tx} />)}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Action drawer */}
      <AnimatePresence>
        {drawer && (
          <ActionDrawer
            type={drawer}
            maxAmount={drawerMax}
            label={drawerLabel}
            onConfirm={handleConfirm}
            onClose={() => setDrawer(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
