/**
 * Shown after files are picked, before anything is uploaded.
 * The user can upload normally, or lock the files with a password: the files
 * are then encrypted in the browser and the password never leaves it.
 */

import { useState } from "react";
import { Lock, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { MAX_LOCKED_FILE_BYTES } from "../../crypto/lockCrypto";

interface UploadOptionsModalProps {
  files: File[];
  /** password is null for a normal (unlocked) upload */
  onConfirm: (password: string | null) => void;
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export default function UploadOptionsModal({
  files,
  onConfirm,
  onClose,
}: UploadOptionsModalProps) {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const tooLarge = files.filter((f) => f.size > MAX_LOCKED_FILE_BYTES);
  const limitMb = MAX_LOCKED_FILE_BYTES / (1024 * 1024);

  let problem: string | null = null;
  if (lockEnabled) {
    if (tooLarge.length > 0) {
      problem = `Locked files are limited to ${limitMb}MB. Too large: ${tooLarge
        .map((f) => f.name)
        .join(", ")}`;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      problem = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    } else if (password !== confirmPassword) {
      problem = "Passwords do not match";
    } else if (!acknowledged) {
      problem = "Please confirm you understand the password cannot be recovered";
    }
  }
  const canSubmit = !lockEnabled || problem === null;

  function handleConfirm() {
    if (!canSubmit) return;
    onConfirm(lockEnabled ? password : null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-options-title"
      >
        <h2
          id="upload-options-title"
          className="text-base font-semibold text-slate-900 mb-1"
        >
          Upload {files.length > 1 ? `${files.length} files` : "file"}
        </h2>
        <ul className="text-sm text-slate-500 mb-4 max-h-24 overflow-y-auto">
          {files.map((f) => (
            <li key={f.name} className="truncate">
              {f.name}
            </li>
          ))}
        </ul>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={lockEnabled}
            onChange={(e) => setLockEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
          />
          <Lock size={14} aria-hidden="true" />
          Lock with a password
        </label>

        {lockEnabled && (
          <div className="space-y-3 mb-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="File password"
                autoComplete="new-password"
                className="w-full text-sm px-3 py-2 pr-10 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
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
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder="Confirm password"
              autoComplete="new-password"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
              <AlertTriangle
                size={16}
                className="flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p>
                The file is encrypted in your browser and the password is never
                sent to the server. <strong>If you forget the password, the
                file cannot be recovered</strong> - not by you, and not by an
                administrator.
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
              />
              I understand the password cannot be recovered
            </label>
          </div>
        )}

        {lockEnabled && problem && (
          <p className="text-xs text-red-600 mb-3" role="alert">
            {problem}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {lockEnabled ? "Encrypt & upload" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
