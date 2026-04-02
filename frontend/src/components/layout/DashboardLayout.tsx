import { AnimatePresence, motion } from "framer-motion";
import { useState }                 from "react";
import { Sidebar, type NavGroup }    from "./Sidebar";
import type { ReactNode }            from "react";

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Routes: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M2 8h12M7 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Compare: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M3 13V7m3 6V3m3 10V6m3 7V2" strokeLinecap="round" />
    </svg>
  ),
  Banking: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="1" y="6" width="14" height="8" rx="1.5" />
      <path d="M4 6V4.5a4 4 0 018 0V6" strokeLinecap="round" />
    </svg>
  ),
  Pooling: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4l8 8" strokeLinecap="round" strokeDasharray="1.5 2" />
    </svg>
  ),
  Audit: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M10 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5l-3-3z" strokeLinejoin="round" />
      <path d="M10 2v3h3M5 9h6M5 11.5h4" strokeLinecap="round" />
    </svg>
  ),
  Settings: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v1.2m0 10.6v1.2m5.2-5.2h-1.2M3 8H1.8m4.2-4.2-.85-.85M11 11l-.85-.85M5.05 11l-.85.85M11.65 5.05l-.85.85" strokeLinecap="round" />
    </svg>
  ),
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { id: "routes",  label: "Routes",  icon: Icons.Routes  },
      { id: "compare", label: "Compare", icon: Icons.Compare },
      { id: "banking", label: "Banking", icon: Icons.Banking },
      { id: "pooling", label: "Pooling", icon: Icons.Pooling },
    ],
  },
  {
    label: "Reports",
    items: [
      { id: "audit",    label: "Audit Log", icon: Icons.Audit    },
      { id: "settings", label: "Settings",  icon: Icons.Settings },
    ],
  },
];

const PAGE_META: Record<string, { title: string; sub: string }> = {
  routes:   { title: "Routes",    sub: "Voyage records & GHG compliance"    },
  compare:  { title: "Compare",   sub: "Baseline vs. fleet analysis"        },
  banking:  { title: "Banking",   sub: "Article 20 — surplus crediting"     },
  pooling:  { title: "Pooling",   sub: "Article 21 — fleet allocation"      },
  audit:    { title: "Audit Log", sub: "Compliance activity history"        },
  settings: { title: "Settings",  sub: "Configuration & preferences"        },
};

// ─── Page transition ──────────────────────────────────────────────────────────

const PAGE = {
  initial: { opacity: 0, y: 8,  filter: "blur(2px)" },
  animate: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0, y: -4, filter: "blur(1px)",
    transition: { duration: 0.14, ease: "easeIn" },
  },
};

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ pageKey }: { pageKey: string }) {
  const meta = PAGE_META[pageKey] ?? { title: pageKey, sub: "" };

  return (
    <header
      className="flex items-center justify-between px-8 py-4 sticky top-0 z-20"
      style={{
        background:     "rgba(17,24,39,0.8)",
        borderBottom:   "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div>
        <AnimatePresence mode="wait">
          <motion.h1
            key={`title-${pageKey}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            className="text-[18px] font-semibold tracking-tight text-white"
          >
            {meta.title}
          </motion.h1>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.p
            key={`sub-${pageKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, delay: 0.04 }}
            className="text-[13px]"
            style={{ color: "#64748b" }}
          >
            {meta.sub}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-[450] transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.05)",
            border:     "1px solid rgba(255,255,255,0.11)",
            color:      "#94a3b8",
          }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
          </svg>
          Filter
        </button>

        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-[500] text-white transition-all duration-150 hover:-translate-y-px"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow:  "0 4px 16px rgba(99,102,241,0.3)",
          }}
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Add route
        </button>
      </div>
    </header>
  );
}

// ─── Sidebar footer ───────────────────────────────────────────────────────────

function SidebarFooter() {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
      style={{
        background: "rgba(16,185,129,0.06)",
        border:     "1px solid rgba(16,185,129,0.15)",
      }}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: "#10b981", boxShadow: "0 0 8px rgba(16,185,129,0.6)" }}
      />
      <p className="text-[12px]" style={{ color: "#94a3b8" }}>
        <span style={{ color: "#10b981", fontWeight: 500 }}>2 routes</span> compliant
      </p>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  children: (tab: string) => ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [active, setActive] = useState("routes");

  return (
    <div className="flex min-h-screen" style={{ background: "#0b0f1a", color: "#f1f5f9" }}>
      <Sidebar
        groups={NAV_GROUPS}
        active={active}
        onSelect={setActive}
        footer={<SidebarFooter />}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar pageKey={active} />

        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              variants={PAGE}
              initial="initial"
              animate="animate"
              exit="exit"
              className="p-8"
            >
              {children(active)}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Status bar */}
        <footer
          className="flex items-center justify-between px-8 py-2 shrink-0"
          style={{
            background:  "rgba(17,24,39,0.6)",
            borderTop:   "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "#334155" }}>
            <span>Target: <span style={{ color: "rgba(245,158,11,0.6)", fontFamily: "monospace" }}>89.3368 gCO₂e/MJ</span></span>
            <span>·</span>
            <span>LHV 41,000 MJ/t</span>
          </div>
          <span className="text-[11px]" style={{ color: "#1e293b" }}>
            (EU) 2023/1805 · Hexagonal Architecture
          </span>
        </footer>
      </div>
    </div>
  );
}
