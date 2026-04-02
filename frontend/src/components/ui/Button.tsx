import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode }   from "react";

// ─── Variant styles ───────────────────────────────────────────────────────────

const VARIANTS = {
  primary: {
    base:  "bg-gradient-to-br from-[#4338ca] to-[#7c3aed] text-white",
    shadow: "0 1px 0 rgba(0,0,0,0.35), 0 4px 18px rgba(79,70,229,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
    glow:   "0 2px 2px rgba(0,0,0,0.35), 0 8px 28px rgba(79,70,229,0.50), inset 0 1px 0 rgba(255,255,255,0.14)",
  },
  ghost: {
    base:  "bg-white/[0.045] text-slate-300 border border-white/[0.095]",
    shadow: "none",
    glow:   "none",
  },
  success: {
    base:  "bg-gradient-to-br from-[#065f46] to-[#059669] text-emerald-100 border border-emerald-500/35",
    shadow: "0 1px 0 rgba(0,0,0,0.3), 0 3px 12px rgba(5,150,105,0.22)",
    glow:   "0 2px 2px rgba(0,0,0,0.3), 0 6px 20px rgba(5,150,105,0.38)",
  },
  danger: {
    base:  "bg-gradient-to-br from-[#881337] to-[#be123c] text-rose-100 border border-rose-500/35",
    shadow: "0 1px 0 rgba(0,0,0,0.3), 0 3px 12px rgba(190,18,60,0.22)",
    glow:   "0 2px 2px rgba(0,0,0,0.3), 0 6px 20px rgba(190,18,60,0.38)",
  },
  outline: {
    base:  "bg-transparent text-slate-400 border border-white/[0.095]",
    shadow: "none",
    glow:   "none",
  },
} as const;

// ─── Size styles ──────────────────────────────────────────────────────────────

const SIZES = {
  xs: "px-2.5 py-1   text-[11px] gap-1.5 rounded-[7px]",
  sm: "px-[13px] py-[6.5px] text-[12.5px] gap-1.5 rounded-[9px]",
  md: "px-[18px] py-[8px]   text-[13px]  gap-2   rounded-[10px]",
  lg: "px-[22px] py-[10px]  text-[13.5px] gap-2.5 rounded-[11px]",
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize    = keyof typeof SIZES;

type NativeProps = Omit<HTMLMotionProps<"button">, "children">;

export interface ButtonProps extends NativeProps {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  iconLeft?:  ReactNode;
  iconRight?: ReactNode;
  children?:  ReactNode;
  className?: string;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin"
      style={{ width: 13, height: 13 }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant   = "primary",
    size      = "md",
    loading   = false,
    iconLeft,
    iconRight,
    children,
    disabled,
    className = "",
    ...rest
  },
  ref,
) {
  const v    = VARIANTS[variant];
  const s    = SIZES[size];
  const off  = disabled || loading;

  return (
    <motion.button
      ref={ref}
      disabled={off}
      // Spring physics on release make the button feel elastic, not rubber-stamped
      whileHover={off ? {} : {
        y: variant === "ghost" || variant === "outline" ? -0.5 : -1.5,
        boxShadow: v.glow,
        transition: { type: "spring", stiffness: 400, damping: 20 },
      }}
      whileTap={off ? {} : {
        scale: 0.95,
        transition: { duration: 0.08 },
      }}
      initial={{ boxShadow: v.shadow }}
      className={[
        "inline-flex items-center justify-center font-[500]",
        "select-none outline-none cursor-pointer",
        "transition-[background,border-color,color,opacity] duration-[140ms]",
        v.base,
        s,
        off ? "opacity-40 !cursor-not-allowed" : "",
        // Ghost / outline hover color lift
        variant === "ghost"   ? "hover:bg-white/[0.08] hover:text-slate-100 hover:border-white/[0.14]" : "",
        variant === "outline" ? "hover:border-white/[0.14] hover:text-slate-200" : "",
        className,
      ].join(" ")}
      style={{ boxShadow: v.shadow }}
      {...rest}
    >
      {loading ? <Spinner /> : iconLeft && <span style={{ width: 14, height: 14, display: "flex" }}>{iconLeft}</span>}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span style={{ width: 14, height: 14, display: "flex" }}>{iconRight}</span>}
    </motion.button>
  );
});
