import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  completeNewPassword,
  validatePassword,
  type AuthTokens,
} from "../auth/authClient";
import { useAuth } from "../auth/useAuth";
import { getApiBaseUrl, authHeaders, handleResponse } from "../api/utils";
import AuthCard from "../components/auth/AuthCard";

export default function OnboardingPage() {
  const { finalizeSession } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nric, setNric] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTokens, setPendingTokens] = useState<AuthTokens | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordError = newPassword ? validatePassword(newPassword) : null;

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const tokens = await completeNewPassword(newPassword);
      setPendingTokens(tokens);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNricSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (nric.length !== 4 || !/^[a-zA-Z0-9]{4}$/.test(nric)) {
      setError("NRIC must be exactly 4 alphanumeric characters");
      return;
    }

    if (!pendingTokens) {
      setError("Session expired. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      await handleResponse(
        await fetch(`${getApiBaseUrl()}/onboarding/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(pendingTokens.idToken),
          },
          body: JSON.stringify({ nric_last4: nric }),
        }),
      );
      await finalizeSession(pendingTokens);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete onboarding",
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <AuthCard>
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Step {step} of 2
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          {step === 1 ? "Set your password" : "Verify your identity"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {step === 1
            ? "Choose a permanent password to secure your account."
            : "Enter the last 4 characters of your NRIC or Passport number."}
        </p>
      </div>
      {step === 1 && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 text-xs text-red-600">{passwordError}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !!passwordError}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Setting password..." : "Set Password"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleNricSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="nric"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Last 4 characters of NRIC / Passport
            </label>
            <input
              id="nric"
              type="text"
              required
              maxLength={4}
              value={nric}
              onChange={(e) => setNric(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="e.g. 567A"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Verifying..." : "Complete Setup"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
