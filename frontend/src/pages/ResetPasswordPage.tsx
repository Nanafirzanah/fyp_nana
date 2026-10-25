import { useState, type FormEvent } from "react";
import { CheckCircle, Eye, EyeOff } from "lucide-react";
import { validatePassword } from "../auth/authClient";
import { getApiBaseUrl, handleResponse } from "../api/utils";
import AuthCard from "../components/auth/AuthCard";

function getResetParams(): { token: string | null; email: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { token: params.get("token"), email: params.get("email") };
}

export default function ResetPasswordPage() {
  const { token, email } = getResetParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordHint = password ? validatePassword(password) : null;

  if (!token || !email) {
    return (
      <AuthCard>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Invalid Link</h1>
          <p className="mt-2 text-sm text-slate-500">
            This reset link is missing required parameters. Please request a new
            one.
          </p>
          <a
            href="/forgot-password"
            className="mt-6 block text-sm font-medium text-slate-900 hover:underline"
          >
            Request a new link
          </a>
        </div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard>
        <div className="text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h1 className="text-xl font-semibold text-slate-900">
            Password Reset
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your password has been updated. You can now log in with your new
            password.
          </p>
          <a
            href="/login"
            className="mt-6 block text-sm font-medium text-slate-900 hover:underline"
          >
            Back to login
          </a>
        </div>
      </AuthCard>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await handleResponse(
        await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            work_email: email,
            new_password: password,
          }),
        }),
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Reset Password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your new password below.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordHint && (
            <p className="mt-1 text-xs text-red-600">{passwordHint}</p>
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
          disabled={isSubmitting || !!passwordHint}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </button>
        <a
          href="/login"
          className="block text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Back to login
        </a>
      </form>
    </AuthCard>
  );
}
