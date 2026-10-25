/**
 * Asks for the password of a locked file. The password is used only in the
 * browser: it is turned into a verifier for the server and into the AES key.
 */

import { useState } from "react";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import type { Document } from "../../types";

interface UnlockModalProps {
  document: Document;
  /** Resolves on success; rejects with an Error whose message is shown to the user. */
  onUnlock: (password: string) => Promise<void>;
  onClose: () => void;
}

/** "403: Invalid password. 4 attempt(s) left." becomes "Invalid password. 4 attempt(s) left." */
function friendlyMessage(err: unknown): string {
  if (err instanceof Error) {
    return (
      err.message.replace(/^\d{3}:\s*/, "") || "Could not unlock the file."
    );
  }
  return "Could not unlock the file.";
}

export default function UnlockModal({
  document,
  onUnlock,
  onClose,
}: UnlockModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUnlock(password);
    } catch (err) {
      setError(friendlyMessage(err));
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-modal-title"
      >
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <Lock size={20} className="text-amber-700" aria-hidden="true" />
        </div>
        <h2
          id="unlock-modal-title"
          className="text-base font-semibold text-slate-900 mb-1"
        >
          This file is locked
        </h2>
        <p className="text-sm text-slate-500 mb-4 break-words">
          Enter the password to download{" "}
          <span className="font-medium text-slate-700">
            {document.display_name}
          </span>
          .
        </p>

        <div className="relative mb-2">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="File password"
            autoFocus
            autoComplete="off"
            disabled={busy}
            className="w-full text-sm px-3 py-2 pr-10 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
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

        {error && (
          <p className="text-xs text-red-600 mb-2" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!password || busy}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? "Decrypting..." : "Unlock & download"}
          </button>
        </div>
      </div>
    </div>
  );
}
