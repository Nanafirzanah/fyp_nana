import type { Folder as FolderType } from "../../types";
import ContextMenu, {
  type ContextMenuItem,
  type ContextMenuHandle,
} from "../ui/ContextMenu";
import { Pencil, Trash2, Folder, Move } from "lucide-react";
import { useRef } from "react";

interface FolderRowProps {
  folder: FolderType;
  onOpen: (folderId: string) => void;
  onRename: (folder: FolderType) => void;
  onDelete: (folder: FolderType) => void;
  onMove: (folder: FolderType) => void;
  selected?: boolean;
  onToggleSelect?: (folderId: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function FolderRow({
  folder,
  onOpen,
  onRename,
  onDelete,
  onMove,
  selected = false,
  onToggleSelect,
}: FolderRowProps) {
  const menuRef = useRef<ContextMenuHandle>(null);
  const menuItems: ContextMenuItem[] = [
    {
      label: "Open",
      icon: <Folder size={14} />,
      onClick: () => onOpen(folder.folder_id),
    },
    {
      label: "Rename",
      icon: <Pencil size={14} />,
      onClick: () => onRename(folder),
    },
    {
      label: "Move",
      icon: <Move size={14} />,
      onClick: () => onMove(folder),
    },
    {
      label: "Delete",
      icon: <Trash2 size={14} />,
      onClick: () => onDelete(folder),
      danger: true,
    },
  ];

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${selected ? "bg-blue-50" : ""}`}
      onDoubleClick={() => onOpen(folder.folder_id)}
      onContextMenu={(e) => {
        e.preventDefault();
        menuRef.current?.openAt(e.clientX, e.clientY);
      }}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect(folder.folder_id)}
          className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300 flex-shrink-0 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          aria-label={`Select ${folder.name}`}
        />
      )}
      {/* Folder Icon */}
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Folder size={18} className="text-blue-500" aria-hidden="true" />
      </div>

      {/* Folder Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {folder.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Folder &middot; {formatDate(folder.created_at)}
        </p>
      </div>
      <div className="hidden sm:block text-xs text-slate-400 flex-shrink-0 max-w-[140px] truncate">
        {folder.created_by_name}
      </div>
      <ContextMenu items={menuItems} ref={menuRef} />
    </div>
  );
}
