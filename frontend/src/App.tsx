import { Suspense, lazy } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const RoutesTab  = lazy(() => import("@/adapters/ui/tabs/RoutesTab"));
const CompareTab = lazy(() => import("@/adapters/ui/tabs/CompareTab"));
const BankingTab = lazy(() => import("@/adapters/ui/tabs/BankingTab"));
const PoolingTab = lazy(() => import("@/adapters/ui/tabs/PoolingTab"));

const TABS: Record<string, React.ComponentType> = {
  routes:  RoutesTab,
  compare: CompareTab,
  banking: BankingTab,
  pooling: PoolingTab,
};

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl" style={{ background: "#111827" }} />
        ))}
      </div>
      <div className="h-64 rounded-2xl" style={{ background: "#111827" }} />
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-[400px] gap-4 rounded-2xl"
      style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,.15), rgba(168,85,247,.1))",
          border: "1px solid rgba(99,102,241,.2)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#818cf8" strokeWidth={1.5}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v4" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r=".5" fill="#818cf8" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-white mb-1.5">{label} tab</p>
        <p className="text-[13px]" style={{ color: "#64748b" }}>Ready to be implemented.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DashboardLayout>
      {(tab) => {
        const TabComponent = TABS[tab];
        if (!TabComponent) return <PlaceholderTab label={tab.charAt(0).toUpperCase() + tab.slice(1)} />;
        return (
          <Suspense fallback={<TabSkeleton />}>
            <TabComponent />
          </Suspense>
        );
      }}
    </DashboardLayout>
  );
}
