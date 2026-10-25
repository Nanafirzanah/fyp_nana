/**
 * Top bar: page title on the left, department and account on the right.
 * The menu button is shown on mobile only (it opens the sidebar drawer).
 */

import { Menu, CircleUserRound } from "lucide-react";
import type { EmployeeProfile } from "../../types";

interface TopBarProps {
  profile: EmployeeProfile;
  title: string;
  icon: React.ReactNode;
  onMenuOpen: () => void;
}

export default function TopBar({
  profile,
  title,
  icon,
  onMenuOpen,
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-4 md:px-6 h-14 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuOpen}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2 text-sm text-blue-600 font-medium min-w-0">
          <span className="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {profile.department}
        </span>
        <span
          className="text-slate-800"
          title={`${profile.name} (${profile.email})`}
        >
          <CircleUserRound size={28} strokeWidth={1.6} aria-hidden="true" />
        </span>
      </div>
    </header>
  );
}
