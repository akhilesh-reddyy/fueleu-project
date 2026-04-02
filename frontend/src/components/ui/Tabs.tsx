import {
  createContext, useContext, useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Context ──────────────────────────────────────────────────────────────────

interface TabsCtx {
  active:    string;
  setActive: (id: string) => void;
  variant:   TabsVariant;
}

const Ctx = createContext<TabsCtx | null>(null);

function useTabs(): TabsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("<TabTrigger> must be inside <Tabs>");
  return ctx;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabsVariant = "underline" | "pill" | "segment";

// ─── Variant trigger styles ───────────────────────────────────────────────────

const TRIGGER_STYLES: Record<TabsVariant, {
  list:     string;
  item:     string;
  active:   string;
  inactive: string;
}> = {
  underline: {
    list:     "flex gap-0 border-b border-white/[0.06]",
    item:     "relative px-4 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase transition-colors duration-150 select-none cursor-pointer bg-transparent border-none",
    active:   "text-indigo-400",
    inactive: "text-slate-500 hover:text-slate-300",
  },
  pill: {
    list:     "flex gap-1.5 p-1 bg-[#0c1019] rounded-[10px] border border-white/[0.06]",
    item:     "relative px-3 py-1.5 font-mono text-[10px] tracking-[0.09em] uppercase rounded-[8px] transition-colors duration-150 select-none cursor-pointer bg-transparent border-none",
    active:   "text-white",
    inactive: "text-slate-500 hover:text-slate-300",
  },
  segment: {
    list:     "flex gap-0 bg-[#0c1019] rounded-[10px] border border-white/[0.06] overflow-hidden",
    item:     "relative flex-1 text-center px-4 py-2 font-mono text-[10px] tracking-[0.09em] uppercase transition-colors duration-150 select-none cursor-pointer bg-transparent border-r border-white/[0.06] last:border-r-0 last:border-none",
    active:   "text-white",
    inactive: "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]",
  },
};

// ─── Active indicator per variant ─────────────────────────────────────────────

function ActiveIndicator({ variant }: { variant: TabsVariant }) {
  if (variant === "underline") {
    return (
      <motion.span
        layoutId="tabs-underline"
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
        style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    );
  }
  if (variant === "pill") {
    return (
      <motion.span
        layoutId="tabs-pill"
        className="absolute inset-0 rounded-[8px] bg-[#101520] border border-white/[0.09]"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    );
  }
  if (variant === "segment") {
    return (
      <motion.span
        layoutId="tabs-segment"
        className="absolute inset-0 bg-white/[0.06]"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    );
  }
  return null;
}

// ─── Page transition ──────────────────────────────────────────────────────────

const PAGE = {
  initial: { opacity: 0, y: 5,  filter: "blur(1.5px)" },
  animate: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0, y: -3, filter: "blur(1px)",
    transition: { duration: 0.12, ease: "easeIn" },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

interface TabsProps {
  defaultTab:  string;
  variant?:    TabsVariant;
  onChange?:   (id: string) => void;
  children:    ReactNode;
  className?:  string;
}

export function Tabs({ defaultTab, variant = "underline", onChange, children, className = "" }: TabsProps) {
  const [active, setActiveRaw] = useState(defaultTab);

  function setActive(id: string) {
    setActiveRaw(id);
    onChange?.(id);
  }

  return (
    <Ctx.Provider value={{ active, setActive, variant }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

interface TabListProps { children: ReactNode; className?: string }

export function TabList({ children, className = "" }: TabListProps) {
  const { variant } = useTabs();
  return (
    <div role="tablist" className={`${TRIGGER_STYLES[variant].list} ${className}`}>
      {children}
    </div>
  );
}

interface TabTriggerProps {
  id:         string;
  children:   ReactNode;
  badge?:     ReactNode;
  disabled?:  boolean;
  className?: string;
}

export function TabTrigger({ id, children, badge, disabled = false, className = "" }: TabTriggerProps) {
  const { active, setActive, variant } = useTabs();
  const isActive = id === active;
  const s = TRIGGER_STYLES[variant];

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      disabled={disabled}
      onClick={() => !disabled && setActive(id)}
      className={[
        s.item,
        isActive  ? s.active   : "",
        !isActive ? s.inactive : "",
        disabled  ? "opacity-35 cursor-not-allowed" : "",
        "flex items-center gap-2",
        className,
      ].join(" ")}
    >
      {isActive && <ActiveIndicator variant={variant} />}
      <span className="relative z-10">{children}</span>
      {badge && <span className="relative z-10 ml-1">{badge}</span>}
    </button>
  );
}

interface TabPanelProps {
  id:         string;
  children:   ReactNode;
  className?: string;
  static?:    boolean;
}

export function TabPanel({ id, children, className = "", static: isStatic = false }: TabPanelProps) {
  const { active } = useTabs();
  const isActive   = id === active;

  if (isStatic) {
    return isActive
      ? <div role="tabpanel" id={`tabpanel-${id}`} className={className}>{children}</div>
      : null;
  }

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={id}
          role="tabpanel"
          id={`tabpanel-${id}`}
          variants={PAGE}
          initial="initial"
          animate="animate"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── TabSet convenience wrapper ───────────────────────────────────────────────

export interface TabDefinition {
  id:        string;
  label:     string;
  badge?:    ReactNode;
  disabled?: boolean;
  content:   ReactNode;
}

interface TabSetProps {
  tabs:        TabDefinition[];
  defaultTab?: string;
  variant?:    TabsVariant;
  onChange?:   (id: string) => void;
  listClass?:  string;
  panelClass?: string;
  className?:  string;
}

export function TabSet({
  tabs,
  defaultTab,
  variant    = "underline",
  onChange,
  listClass  = "",
  panelClass = "mt-5",
  className  = "",
}: TabSetProps) {
  const first = defaultTab ?? tabs[0]?.id ?? "";

  return (
    <Tabs defaultTab={first} variant={variant} onChange={onChange} className={className}>
      <TabList className={listClass}>
        {tabs.map(t => (
          <TabTrigger key={t.id} id={t.id} badge={t.badge} disabled={t.disabled}>
            {t.label}
          </TabTrigger>
        ))}
      </TabList>
      {tabs.map(t => (
        <TabPanel key={t.id} id={t.id} className={panelClass}>
          {t.content}
        </TabPanel>
      ))}
    </Tabs>
  );
}
