import { motion } from "framer-motion";

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANTS = {
  success: {
    container: "bg-emerald-900/55 border-emerald-500/[0.14] text-emerald-300",
    dot: "#34d399",
    label: "Compliant",
  },
  warning: {
    container: "bg-amber-900/50 border-amber-500/[0.14] text-amber-300",
    dot: "#fbbf24",
    label: "Warning",
  },
  error: {
    container: "bg-rose-900/50 border-rose-500/[0.14] text-rose-300",
    dot: "#fb7185",
    label: "Non-compliant",
  },
  neutral: {
    container: "bg-slate-800/60 border-slate-700/50 text-slate-400",
    dot: "#64748b",
    label: "Neutral",
  },
  baseline: {
    container: "bg-indigo-900/55 border-indigo-500/[0.15] text-indigo-300",
    dot: "#a5b4fc",
    label: "Baseline",
  },
  surplus: {
    container: "bg-emerald-900/55 border-emerald-500/[0.14] text-emerald-300",
    dot: "#34d399",
    label: "Surplus",
  },
  deficit: {
    container: "bg-rose-900/50 border-rose-500/[0.14] text-rose-300",
    dot: "#fb7185",
    label: "Deficit",
  },
  banked: {
    container: "bg-sky-900/50 border-sky-500/[0.14] text-sky-300",
    dot: "#38bdf8",
    label: "Banked",
  },
} as const;

// ─── Size config ──────────────────────────────────────────────────────────────

const SIZES = {
  xs: { badge: "px-1.5 py-[2px] text-[8.5px] gap-1",   dot: "w-[4px] h-[4px]" },
  sm: { badge: "px-2   py-[2.5px] text-[9px]  gap-1.5", dot: "w-[5px] h-[5px]" },
  md: { badge: "px-2.5 py-[3px]   text-[11px] gap-1.5", dot: "w-[5px] h-[5px]" },
  lg: { badge: "px-3   py-1       text-[12px] gap-2",   dot: "w-[6px] h-[6px]" },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeVariant = keyof typeof VARIANTS;
export type BadgeSize    = keyof typeof SIZES;

export interface BadgeProps {
  variant?:   BadgeVariant;
  size?:      BadgeSize;
  label?:     string;
  pulse?:     boolean;
  icon?:      React.ReactNode;
  className?: string;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({
  variant   = "neutral",
  size      = "md",
  label,
  pulse     = false,
  icon,
  className = "",
}: BadgeProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const text = label ?? v.label;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`inline-flex items-center rounded-full font-[500] tracking-[0.04em] uppercase border whitespace-nowrap ${v.container} ${s.badge} ${className}`}
    >
      {icon ? (
        <span className="flex-shrink-0 opacity-80">{icon}</span>
      ) : (
        <span className={`relative flex-shrink-0 rounded-full ${s.dot}`} style={{ background: v.dot }}>
          {pulse && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full animate-ping opacity-60"
              style={{ background: v.dot }}
            />
          )}
        </span>
      )}
      {text}
    </motion.span>
  );
}

// ─── NumericBadge ─────────────────────────────────────────────────────────────

export interface NumericBadgeProps {
  count:      number;
  max?:       number;
  variant?:   Extract<BadgeVariant, "success" | "warning" | "error" | "neutral">;
  className?: string;
}

export function NumericBadge({
  count,
  max = 99,
  variant = "neutral",
  className = "",
}: NumericBadgeProps) {
  const v       = VARIANTS[variant];
  const display = count > max ? `${max}+` : String(count);

  return (
    <motion.span
      key={count}
      initial={{ scale: 1.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex items-center justify-center rounded-sm min-w-[18px] h-[18px] px-1 font-[500] text-[8px] tracking-wider border ${v.container} ${className}`}
    >
      {display}
    </motion.span>
  );
}
