/**
 * Fodler picker modal for moving files and folder
 *  Navigate the dept folder
 */

import { useState, useEffect, useCallback } from "react";
import { Folder as FolderIcon, ChevronRight, X } from "lucide-react";
import type { Folder, MoveTarget } from "../../types";
import { listFolders } from "../../api/foldersApi";
import { moveItems } from "../../api/documentsApi";
import { toast } from "sonner";

interface BreadcrumbEntry {
  folderId: string;
  folderName: string;
}

interface MoveModalProps {
  idToken: string;
  moveTarget: MoveTarget;
  onClose: () => void;
  onMoved: () => void;
}

function describeMoveTarget(target: MoveTarget): string {
  const parts: string[] = [];
  if (target.fileIds.length > 0) {
    parts.push(
      `${target.fileIds.length} file${target.fileIds.length > 1 ? "s" : ""}`,
    );
  }
  if (target.folderIds.length > 0) {
    parts.push(
      `${target.folderIds.length} folder${target.folderIds.length > 1 ? "s" : ""}`,
    );
  }
  return parts.join(" and ");
}

export default function MoveModal({
  idToken,
  moveTarget,
  onClose,
  onMoved,
}: MoveModalProps) {
  const [stack, setStack] = useState<BreadcrumbEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);

  const currentFolderId = stack.at(-1)?.folderId ?? null;

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFolders(idToken, currentFolderId ?? undefined);
      setFolders(
        data.folders.filter((f) => !moveTarget.folderIds.includes(f.folder_id)),
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, [idToken, currentFolderId, moveTarget.folderIds]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleOpenFolder(folder: Folder) {
    setStack((prev) => [
      ...prev,
      { folderId: folder.folder_id, folderName: folder.name },
    ]);
  }

  function handleGoRoot() {
    setStack([]);
  }

  function handleBreadcrumbNav(index: number) {
    setStack((prev) => prev.slice(0, index + 1));
  }

  async function handleMoveHere() {
    setMoving(true);
    try {
      await moveItems(
        idToken,
        moveTarget.fileIds,
        moveTarget.folderIds,
        currentFolderId,
      );
      toast.success("Moved successfully");
      onMoved();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "";
      const colonIndex = message.indexOf(":");
      const detail =
        colonIndex >= 0 ? message.slice(colonIndex + 1).trim() : "";
      toast.error(detail || "Move failed. Try again");
    } finally {
      setMoving(false);
    }
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
        className="relative z-10 w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-6 flex flex-col max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-modal-title"
      >
        <div className="flex items-center justify-between mb-1">
          <h2
            id="move-modal-title"
            className="text-base font-semibold text-slate-900"
          >
            Move to...
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Moving {describeMoveTarget(moveTarget)}
        </p>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 flex-wrap">
          <button
            onClick={handleGoRoot}
            className={`transition-colors ${stack.length > 0 ? "hover:text-blue-600 cursor-pointer" : "text-slate-600 font-medium pointer-events-none"}`}
          >
            Documents
          </button>
          {stack.map((entry, index) => (
            <span key={entry.folderId} className="flex items-center gap-1.5">
              <ChevronRight size={12} aria-hidden="true" />
              <button
                onClick={() =>
                  index < stack.length - 1
                    ? handleBreadcrumbNav(index)
                    : undefined
                }
                className={`transition-colors ${index < stack.length - 1 ? "hover:text-blue-600 cursor-pointer" : "text-slate-600 font-medium pointer-events-none"}`}
              >
                {entry.folderName}
              </button>
            </span>
          ))}
        </div>

        {/* Folder List  */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg mb-4 min-h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-400">
              Loading...
            </div>
          ) : folders.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-400">
              No subfolders here
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {folders.map((folder) => (
                <button
                  key={folder.folder_id}
                  onClick={() => handleOpenFolder(folder)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FolderIcon
                    size={16}
                    className="text-amber-600 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={moving}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleMoveHere}
            disabled={moving}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            {moving
              ? "Moving..."
              : stack.length > 0
                ? "Move here"
                : "Move to root"}
          </button>
        </div>
      </div>
    </div>
  );
}
