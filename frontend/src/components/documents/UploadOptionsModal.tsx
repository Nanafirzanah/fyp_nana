/**
 * Shown after files or a folder are picked, before anything is uploaded.
 * Two steps, as in the SafeFile prototype:
 *   1. "File or Folder Upload": what will be uploaded, a "Lock Files" tick, Upload.
 *   2. "Security Options": the lock password (only when Lock Files is ticked).
 * Locked files are encrypted in the browser; the password never leaves it.
 */

import { useState } from "react";
import {
  UploadCloud,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  File as FileIcon,
  Folder as FolderIcon,
} from "lucide-react";
import { MAX_LOCKED_FILE_BYTES } from "../../crypto/lockCrypto";
import {
  displayPath,
  getExtension,
  singleTopFolder,
  type UploadItem,
} from "../../utils/uploadItems";

interface UploadOptionsModalProps {
  items: UploadItem[];
  /** password is null for a normal (unlocked) upload */
  onConfirm: (password: string | null) => void;
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function typeLabel(filename: string): string {
  const ext = getExtension(filename);
  switch (ext) {
    case ".pdf":
      return "PDF Document";
    case ".doc":
    case ".docx":
      return "Microsoft Word Document";
    case ".xls":
    case ".xlsx":
      return "Microsoft Excel Document";
    case ".csv":
      return "CSV Spreadsheet";
    case ".pptx":
      return "Microsoft PowerPoint Presentation";
    case ".png":
    case ".jpg":
    case ".jpeg":
      return "Image";
    case ".txt":
      return "Text Document";
    default:
      return "File";
  }
}

function BigIcon({ filename, isFolder }: { filename: string; isFolder: boolean }) {
  if (isFolder) {
    return <FolderIcon size={64} strokeWidth={1.5} className="text-blue-500" />;
  }
  switch (getExtension(filename)) {
    case ".xls":
    case ".xlsx":
    case ".csv":
      return (
        <FileSpreadsheet size={64} strokeWidth={1.5} className="text-green-600" />
      );
    case ".png":
    case ".jpg":
    case ".jpeg":
      return <FileImage size={64} strokeWidth={1.5} className="text-purple-500" />;
    case ".pptx":
      return (
        <Presentation size={64} strokeWidth={1.5} className="text-orange-500" />
      );
    case ".pdf":
      return <FileText size={64} strokeWidth={1.5} className="text-red-500" />;
    case ".doc":
    case ".docx":
    case ".txt":
      return <FileText size={64} strokeWidth={1.5} className="text-blue-500" />;
    default:
      return <FileIcon size={64} strokeWidth={1.5} className="text-slate-500" />;
  }
}

export default function UploadOptionsModal({
  items,
  onConfirm,
  onClose,
}: UploadOptionsModalProps) {
  const [step, setStep] = useState<"options" | "security">("options");
  const [lockEnabled, setLockEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const topFolder = singleTopFolder(items);
  const totalBytes = items.reduce((sum, i) => sum + i.file.size, 0);
  const tooLarge = items.filter((i) => i.file.size > MAX_LOCKED_FILE_BYTES);
  const limitMb = MAX_LOCKED_FILE_BYTES / (1024 * 1024);
  const single = items.length === 1 && !topFolder ? items[0] : null;

  const tooLargeProblem =
    lockEnabled && tooLarge.length > 0
      ? `Locked files are limited to ${limitMb}MB. Too large: ${tooLarge
          .map((i) => displayPath(i))
          .join(", ")}`
      : null;

  let passwordProblem: string | null = null;
  if (password.length < MIN_PASSWORD_LENGTH) {
    passwordProblem = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  } else if (password !== confirmPassword) {
    passwordProblem = "Passwords do not match";
  } else if (!acknowledged) {
    passwordProblem = "Please confirm you understand the password cannot be recovered";
  }

  function handleUpload() {
    if (!lockEnabled) {
      onConfirm(null);
    } else if (!tooLargeProblem) {
      setStep("security");
    }
  }

  function handleDone() {
    if (passwordProblem) return;
    onConfirm(password);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-options-title"
      >
        {step === "options" ? (
          <>
            <h2
              id="upload-options-title"
              className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4"
            >
              <UploadCloud size={18} aria-hidden="true" />
              File or Folder Upload
            </h2>

            <div className="flex flex-col items-center text-center mb-5">
              <BigIcon
                filename={single?.file.name ?? ""}
                isFolder={topFolder !== null}
              />
              <p className="mt-3 text-sm font-medium text-slate-800 break-all">
                {topFolder ?? single?.file.name ?? `${items.length} files`}
              </p>
              <p className="text-xs text-slate-500">
                {single
                  ? `${formatBytes(single.file.size)}, ${typeLabel(single.file.name)}`
                  : `${items.length} ${items.length === 1 ? "file" : "files"}, ${formatBytes(totalBytes)}`}
              </p>
              {!single && (
                <ul className="mt-3 w-full max-h-24 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">
                  {items.map((i) => (
                    <li key={displayPath(i)} className="truncate">
                      {displayPath(i)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-start gap-2 mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={lockEnabled}
                onChange={(e) => setLockEnabled(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  Lock Files
                </span>
                <span className="block text-xs text-slate-500">
                  File will be protected and encrypted before upload in cloud.
                </span>
              </span>
            </label>

            {tooLargeProblem && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {tooLargeProblem}
              </p>
            )}

            <button
              onClick={handleUpload}
              disabled={lockEnabled && !!tooLargeProblem}
              className="mt-5 w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lockEnabled ? "Next" : "Upload"}
            </button>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <h2
              id="upload-options-title"
              className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-4"
            >
              <ShieldCheck size={18} aria-hidden="true" />
              Security Options
            </h2>

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
                className="w-full text-sm px-3 py-2.5 pr-10 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
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
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                The file is encrypted in your browser and the password is never
                sent to the server.{" "}
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
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
              />
              I understand the password cannot be recovered
            </label>

            {passwordProblem && (password || confirmPassword) && (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {passwordProblem}
              </p>
            )}

            <button
              onClick={handleDone}
              disabled={passwordProblem !== null}
              className="mt-5 w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Done
            </button>
            <button
              onClick={() => setStep("options")}
              className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
