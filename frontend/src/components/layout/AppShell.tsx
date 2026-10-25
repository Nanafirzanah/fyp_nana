/**
 * Main layout wrapper for authenticated app.
 * Owns sidebar collapsed & mobile open/close state.
 * Renders sidebar + MobileHeader + main content area
 */

import { useState } from "react";
import Sidebar, { type AppView } from "./Sidebar";
import { LayoutDashboard, Folder, User, ShieldCheck } from "lucide-react";
import TopBar from "./MobileHeader";
import type { EmployeeProfile } from "../../types";

interface AppShellProps {
  profile: EmployeeProfile;
  onSignOut: () => void;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  children: React.ReactNode;
}

const VIEW_META: Record<AppView, { title: string; icon: React.ReactNode }> = {
  overview: { title: "Overview", icon: <LayoutDashboard size={15} /> },
  documents: { title: "My Files", icon: <Folder size={15} /> },
  profile: { title: "My Profile", icon: <User size={15} /> },
  admin: { title: "Admin", icon: <ShieldCheck size={15} /> },
};

export default function AppShell({
  profile,
  onSignOut,
  currentView,
  onViewChange,
  children,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        currentView={currentView}
        onViewChange={onViewChange}
        profile={profile}
        onSignOut={onSignOut}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          profile={profile}
          title={VIEW_META[currentView].title}
          icon={VIEW_META[currentView].icon}
          onMenuOpen={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
