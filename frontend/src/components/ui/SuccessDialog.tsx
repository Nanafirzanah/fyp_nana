/** Centered confirmation with a green check, as in the SafeFile prototype. */

import { Check } from "lucide-react";

interface SuccessDialogProps {
  message: string;
  detail?: string;
  onClose: () => void;
}

export default function SuccessDialog({
  message,
  detail,
  onClose,
}: SuccessDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-xs rounded-xl bg-slate-800 px-6 py-8 text-center shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="success-dialog-message"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-green-400">
          <Check
            size={34}
            strokeWidth={3}
            className="text-green-400"
            aria-hidden="true"
          />
        </div>
        <p
          id="success-dialog-message"
          className="text-sm font-medium text-white"
        >
          {message}
        </p>
        {detail && (
          <p className="mt-1 break-all text-xs text-slate-300">{detail}</p>
        )}
        <button
          autoFocus
          onClick={onClose}
          className="mt-6 w-24 rounded-md bg-white px-4 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          OK
        </button>
      </div>
    </div>
  );
}
