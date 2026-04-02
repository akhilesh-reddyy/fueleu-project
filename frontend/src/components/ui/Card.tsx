import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode }   from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Variant config ───────────────────────────────────────────────────────────

const ORB_COLORS: Record<string, string> = {
  indigo:  "#4f46e5",
  violet:  "#7c3aed",
  emerald: "#059669",
  rose:    "#be123c",
  amber:   "#b45309",
  sky:     "#0369a1",
};

// ─── Card ─────────────────────────────────────────────────────────────────────

export interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  /**
   * glass — extra translucent, backdrop-blur
   * solid — opaque gradient surface (default)
   * accent — indigo-tinted (highlighted data)
   * success / danger — semantic tints
   */
  variant?:  "solid" | "glass" | "accent" | "success" | "danger";
  /** Soft ambient orb behind the content */
  orb?:      "indigo" | "violet" | "emerald" | "rose" | "amber" | "sky";
  /** Hover lift + box-shadow boost */
  hoverable?: boolean;
  /** Padding preset: sm=12/14  md=20/22 (default)  lg=26/28 */
  padding?:  "none" | "sm" | "md" | "lg";
  children?: ReactNode;
  className?: string;
}

const VARIANT_STYLES = {
  solid:   "bg-gradient-to-b from-[rgba(16,21,32,0.90)] to-[rgba(12,16,24,0.96)]",
  glass:   "bg-[rgba(16,21,32,0.64)] backdrop-blur-2xl",
  accent:  "bg-gradient-to-br from-indigo-950/70 to-violet-950/50",
  success: "bg-emerald-950/55",
  danger:  "bg-rose-950/55",
};

const PADDING_STYLES = {
  none: "",
  sm:   "p-3 px-3.5",
  md:   "p-[20px_22px]",
  lg:   "p-[26px_28px]",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant   = "solid",
    orb,
    hoverable = false,
    padding   = "md",
    children,
    className = "",
    ...rest
  },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hoverable ? {
        y: -2.5,
        transition: { type: "spring", stiffness: 340, damping: 22, mass: 0.8 },
      } : undefined}
      className={cn(
        "relative overflow-hidden",
        // Shape + base border
        "rounded-[18px] border border-white/[0.056]",
        // Layered shadow
        "shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_24px_rgba(0,0,0,0.22)]",
        // Top-edge highlight line (physical lighting trick)
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px",
        "after:bg-gradient-to-r after:from-transparent after:via-white/[0.075] after:to-transparent",
        // Hover state
        "transition-[border-color,box-shadow] duration-200",
        hoverable && [
          "hover:border-white/[0.095]",
          "hover:shadow-[0_4px_8px_rgba(0,0,0,0.4),0_16px_48px_rgba(0,0,0,0.32),0_0_0_1px_rgba(255,255,255,0.035)]",
        ],
        // Variant tint
        VARIANT_STYLES[variant],
        // Padding
        PADDING_STYLES[padding],
        className,
      )}
      {...rest}
    >
      {/* Ambient orb — bleeds from top-right corner */}
      {orb && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-7 -right-7 w-[96px] h-[96px] rounded-full"
          style={{
            background: ORB_COLORS[orb] ?? "#4f46e5",
            filter:     "blur(30px)",
            opacity:    0.36,
          }}
        />
      )}

      {children}
    </motion.div>
  );
});

// ─── CardHeader ───────────────────────────────────────────────────────────────

interface CardHeaderProps {
  title:        string;
  description?: string;
  actions?:     ReactNode;
  className?:   string;
}

export function CardHeader({ title, description, actions, className = "" }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h3 className="text-[14px] font-semibold tracking-[-0.022em] text-slate-100 leading-tight">
          {title}
        </h3>
        {description && (
          <p className="text-[11.5px] text-slate-500 mt-1.5 leading-snug">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ─── CardDivider ──────────────────────────────────────────────────────────────

interface CardDividerProps { className?: string; spacing?: "sm" | "md" | "lg" }

export function CardDivider({ className = "", spacing = "md" }: CardDividerProps) {
  const gap = spacing === "sm" ? "my-3" : spacing === "lg" ? "my-6" : "my-5";
  return <div className={cn("h-px bg-white/[0.056]", gap, className)} />;
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:       string;
  value:       ReactNode;
  pill?:       ReactNode;
  sub?:        string;
  orb?:        CardProps["orb"];
  valueColor?: string;
  className?:  string;
}

export function KpiCard({ label, value, pill, sub, orb, valueColor, className = "" }: KpiCardProps) {
  return (
    <Card variant="solid" orb={orb} hoverable padding="none" className={cn("p-[22px_24px]", className)}>
      {/* Label */}
      <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-slate-500 mb-2.5">
        {label}
      </p>
      {/* Value */}
      <p
        className="text-[30px] font-[700] leading-none mb-2.5"
        style={{
          letterSpacing: "-0.048em",
          color: valueColor ?? "#f1f5f9",
        }}
      >
        {value}
      </p>
      {/* Footer meta */}
      {(pill || sub) && (
        <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
          {pill}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </Card>
  );
}
