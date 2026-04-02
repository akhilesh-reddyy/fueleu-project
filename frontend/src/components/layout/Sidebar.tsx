import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode }           from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  id:       string;
  label:    string;
  icon:     ReactNode;
  badge?:   ReactNode;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  groups:   NavGroup[];
  active:   string;
  onSelect: (id: string) => void;
  footer?:  ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({ groups, active, onSelect, footer }: SidebarProps) {
  return (
    <aside
      className="relative flex flex-col w-60 min-h-screen shrink-0"
      style={{ background: "#111827", borderRight: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Gradient right edge */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-px pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(99,102,241,0.3), transparent)" }}
      />

      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            boxShadow:  "0 0 20px rgba(99,102,241,0.4)",
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth={1.8} className="w-[15px] h-[15px]">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3l2 2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-[14px] font-semibold tracking-tight text-white">FuelEU</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#64748b" }}>Maritime · v2.1</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-5 px-3 pt-4 flex-1">
        {groups.map((group) => (
          <div key={group.label}>
            <p
              className="px-2 mb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "#475569" }}
            >
              {group.label}
            </p>

            <div className="flex flex-col gap-0.5">
              {group.items.map((item, i) => {
                const isActive = item.id === active;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2, ease: "easeOut" }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onSelect(item.id)}
                    className="group relative flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-xl text-[13.5px] font-[450] transition-colors duration-150"
                    style={{
                      color:      isActive ? "#fff"     : "#94a3b8",
                      border:     `1px solid ${isActive ? "rgba(99,102,241,0.25)" : "transparent"}`,
                      background: isActive
                        ? "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.12))"
                        : "transparent",
                      boxShadow: isActive
                        ? "0 0 20px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.06)"
                        : undefined,
                    }}
                  >
                    <span
                      className="w-[16px] h-[16px] shrink-0 transition-colors duration-150"
                      style={{ color: isActive ? "#818cf8" : "#475569" }}
                    >
                      {item.icon}
                    </span>

                    <span className="flex-1 truncate">{item.label}</span>

                    {item.badge && <span className="shrink-0">{item.badge}</span>}

                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            background: "#818cf8",
                            boxShadow:  "0 0 8px rgba(129,140,248,0.8)",
                          }}
                        />
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {footer && (
        <div
          className="px-3 pb-5 pt-4 mt-auto"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
