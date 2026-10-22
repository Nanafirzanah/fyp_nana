/**
 * Post-login dashboard. Shows a different title based on the
 * employee's department (from the backend's /me response).
 */

import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import AppShell from "../components/layout/AppShell";
import { type AppView } from "../components/layout/Sidebar";
import DocumentsPage from "./DocumentsPage";
import ProfilePage from "./ProfilePage";
import AdminDashboard from "./AdminDashboard";
import OverviewPage from "./OverviewPage";

export default function Dashboard() {
  const { profile, tokens, logout } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>("documents");

  if (!profile || !tokens) {
    return null;
  }

  return (
    <AppShell
      profile={profile}
      onSignOut={logout}
      currentView={currentView}
      onViewChange={setCurrentView}
    >
      {currentView === "documents" && (
        <DocumentsPage profile={profile} idToken={tokens.idToken} />
      )}
      {currentView === "overview" && (
        <OverviewPage profile={profile} idToken={tokens.idToken} />
      )}
      {currentView === "profile" && (
        <ProfilePage idToken={tokens.idToken} profile={profile} />
      )}
      {currentView === "admin" && profile.role === "system_admin" && (
        <AdminDashboard idToken={tokens.idToken} />
      )}
    </AppShell>
  );
}
