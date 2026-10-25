import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { Toaster } from "sonner";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import OnboardingPage from "./pages/OnboardingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function AppRouter() {
  const { isAuthenticated, isLoading, requiresOnboarding } = useAuth();
  const path = window.location.pathname;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (requiresOnboarding) return <OnboardingPage />;

  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (path === "/reset-password") return <ResetPasswordPage />;

  if (isAuthenticated) return <Dashboard />;

  return <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <AppRouter />
    </AuthProvider>
  );
}
