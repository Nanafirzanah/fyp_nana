/**
 * Rename modal for files and folders
 * Submit on Enter, dismiss on Esc
 */

import { useState } from "react";
import { Pencil } from "lucide-react";

interface RenameModalProps {
  title?: string;
  currentName: string;
  extension?: string;
  onConfirm: (newName: string) => void;
  onClose: () => void;
}

export default function RenameModal({
  title = "Rename",
  currentName,
  extension,
  onConfirm,
  onClose,
}: RenameModalProps) {
  const baseName =
    extension && currentName.endsWith(extension)
      ? currentName.slice(0, -extension.length)
      : currentName;
  const [name, setName] = useState(baseName);
  const isValid = name.trim().length > 0 && name.trim() !== baseName;

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(extension ? `${name.trim()}${extension}` : name.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal Panel */}
      <div
        className="relative z-10 w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-4">
          <Pencil size={18} className="text-blue-600" aria-hidden="true" />
        </div>
        <h2
          id="rename-modal-title"
          className="text-base font-semibold text-slate-900 mb-1"
        >
          {title}
        </h2>
        <p className="text-sm text-slate-500 mb-4">Enter a new name below</p>
        <div className="flex items-center gap-1 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
          />
          {extension && (
            <span className="text-sm text-slate-400 flex-shrink-0 pr-1">
              {extension}
            </span>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
