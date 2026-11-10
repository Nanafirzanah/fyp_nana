/**
 * "Security Options" form from the SafeFile prototype: choose the lock password.
 * Shared by the upload dialog and the "Lock file" dialog. The password is only
 * used in the browser; it is never sent to the server.
 */

import { useState } from "react";
import { ShieldCheck, AlertTriangle, Eye, EyeOff } from "lucide-react";

interface SecurityOptionsProps {
  /** Called with the chosen password once it is valid and acknowledged. */
  onDone: (password: string) => void;
  onBack: () => void;
  backLabel?: string;
  doneLabel?: string;
  /** Busy state of the caller (disables the buttons). */
  disabled?: boolean;
  /** Shown above the form, e.g. which file is being locked. */
  intro?: React.ReactNode;
}

export const MIN_PASSWORD_LENGTH = 8;

export default function SecurityOptions({
  onDone,
  onBack,
  backLabel = "Back",
  doneLabel = "Done",
  disabled = false,
  intro,
}: SecurityOptionsProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  let problem: string | null = null;
  if (password.length < MIN_PASSWORD_LENGTH) {
    problem = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  } else if (password !== confirmPassword) {
    problem = "Passwords do not match";
  } else if (!acknowledged) {
    problem = "Please confirm you understand the password cannot be recovered";
  }

  function handleDone() {
    if (problem || disabled) return;
    onDone(password);
  }

  return (
    <>
      <h2
        id="upload-options-title"
        className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4"
      >
        <ShieldCheck size={18} aria-hidden="true" />
        Security Options
      </h2>

      {intro}

      <label
        htmlFor="lock-password"
        className="block text-sm font-medium text-slate-700 mb-1"
      >
        Lock Password
      </label>
      <div className="relative mb-3">
        <input
          id="lock-password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
          disabled={disabled}
          className="w-full text-sm px-3 py-2.5 pr-10 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <label
        htmlFor="lock-password-confirm"
        className="block text-sm font-medium text-slate-700 mb-1"
      >
        Confirm Password
      </label>
      <input
        id="lock-password-confirm"
        type={showPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleDone()}
        autoComplete="new-password"
        disabled={disabled}
        className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
      />
      <p className="mt-1 mb-3 text-xs text-slate-500">
        File will be protected with this password.
      </p>

      <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
        <AlertTriangle
          size={16}
          className="flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p>
          The file is encrypted in your browser and the password is never sent
          to the server.{" "}
          <strong>
            If you forget the password, the file cannot be recovered
          </strong>{" "}
          - not by you, and not by an administrator.
        </p>
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
        />
        I understand the password cannot be recovered
      </label>

      {problem && (password || confirmPassword) && (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {problem}
        </p>
      )}

      <button
        onClick={handleDone}
        disabled={problem !== null || disabled}
        className="mt-5 w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {doneLabel}
      </button>
      <button
        onClick={onBack}
        disabled={disabled}
        className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
      >
        {backLabel}
      </button>
    </>
  );
}
