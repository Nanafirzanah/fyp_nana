/**
 * File preview dialog: PDF (browser viewer), images, plain text and CSV (table).
 * It only displays what it is given. The caller owns any blob URL it passes and
 * revokes it when the dialog closes.
 */

import { Download, Lock, X } from "lucide-react";
import type { Document } from "../../types";
import { parseCsv, type PreviewKind } from "../../utils/preview";

interface PreviewModalProps {
  document: Document;
  kind: PreviewKind;
  /** pdf and image: where to load it from */
  url?: string;
  /** text and csv: the content */
  text?: string;
  truncated?: boolean;
  /** true when the file was decrypted in the browser */
  decrypted?: boolean;
  onDownload: () => void;
  onClose: () => void;
}

function CsvTable({ text }: { text: string }) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return <p className="p-6 text-sm text-slate-400">This file is empty.</p>;
  }
  const [header, ...body] = rows;
  return (
    <table className="min-w-full text-left text-xs">
      <thead className="sticky top-0 bg-slate-100 text-slate-600">
        <tr>
          {header.map((cell, i) => (
            <th key={i} className="border-b border-slate-200 px-3 py-2 font-medium">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-slate-700">
        {body.map((row, r) => (
          <tr key={r} className="odd:bg-white even:bg-slate-50">
            {row.map((cell, c) => (
              <td key={c} className="border-b border-slate-100 px-3 py-1.5">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PreviewModal({
  document,
  kind,
  url,
  text,
  truncated = false,
  decrypted = false,
  onDownload,
  onClose,
}: PreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <h2
              id="preview-title"
              className="truncate text-sm font-semibold text-slate-900"
            >
              {document.display_name}
            </h2>
            {decrypted && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                <Lock size={11} aria-hidden="true" />
                Decrypted in your browser. Nothing is saved or sent anywhere.
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <Download size={14} aria-hidden="true" />
              Download
            </button>
            <button
              onClick={onClose}
              autoFocus
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
          {kind === "pdf" && url && (
            <iframe
              src={url}
              title={document.display_name}
              className="h-full w-full border-0 bg-white"
            />
          )}
          {kind === "image" && url && (
            <div className="flex h-full items-center justify-center p-4">
              <img
                src={url}
                alt={document.display_name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          {kind === "text" && (
            <pre className="whitespace-pre-wrap break-words p-5 font-mono text-xs text-slate-800">
              {text}
            </pre>
          )}
          {kind === "csv" && <CsvTable text={text ?? ""} />}
          {truncated && (
            <p className="border-t border-slate-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
              Only the beginning of this file is shown. Download it to see everything.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
