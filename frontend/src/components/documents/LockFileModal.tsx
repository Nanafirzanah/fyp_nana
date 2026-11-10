/**
 * "Lock file" dialog for a file that was uploaded without a password.
 * The caller does the work (download, encrypt, send) in onConfirm and throws on
 * failure so the message can be shown here.
 */

import { useState } from "react";
import type { Document } from "../../types";
import SecurityOptions from "./SecurityOptions";

interface LockFileModalProps {
  document: Document;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

export default function LockFileModal({
  document,
  onConfirm,
  onClose,
}: LockFileModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDone(password: string) {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message.replace(/^\d{3}:\s*/, "")
          : "Could not lock the file. Try again.",
      );
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
        className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-options-title"
      >
        <SecurityOptions
          onDone={handleDone}
          onBack={onClose}
          backLabel="Cancel"
          doneLabel={busy ? "Encrypting..." : "Lock file"}
          disabled={busy}
          intro={
            <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">File to lock</p>
              <p className="text-sm font-medium text-slate-800 break-all">
                {document.display_name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                The file is downloaded to your browser, encrypted there, and the
                unprotected copy is replaced.
              </p>
              {error && (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
