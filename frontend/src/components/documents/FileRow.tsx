import {
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  File,
  Pencil,
  Trash2,
  Download,
  Move,
} from "lucide-react";
import type { Document } from "../../types";
import ContextMenu, {
  type ContextMenuItem,
  type ContextMenuHandle,
} from "../ui/ContextMenu";
import { useRef } from "react";

interface FileRowProps {
  document: Document;
  onDownload: (document: Document) => void;
  onRename: (document: Document) => void;
  onDelete: (document: Document) => void;
  onMove: (document: Document) => void;
  onOpen?: (document: Document) => void;
  selected?: boolean;
  onToggleSelect?: (fileId: string) => void;
}

interface ExtensionStyle {
  bg: string;
  text: string;
  icon: React.ReactNode;
}

const EXTENSION_STYLES: Record<string, ExtensionStyle> = {
  pdf: {
    bg: "bg-red-50",
    text: "text-red-600",
    icon: <FileText size={16} />,
  },
  doc: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    icon: <FileText size={16} />,
  },
  docx: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    icon: <FileText size={16} />,
  },
  xls: {
    bg: "bg-green-50",
    text: "text-green-600",
    icon: <FileSpreadsheet size={16} />,
  },
  xlsx: {
    bg: "bg-green-50",
    text: "text-green-600",
    icon: <FileSpreadsheet size={16} />,
  },
  csv: {
    bg: "bg-green-50",
    text: "text-green-600",
    icon: <FileSpreadsheet size={16} />,
  },
  pptx: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    icon: <Presentation size={16} />,
  },
  png: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    icon: <FileImage size={16} />,
  },
  jpg: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    icon: <FileImage size={16} />,
  },
  jpeg: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    icon: <FileImage size={16} />,
  },
  txt: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    icon: <FileText size={16} />,
  },
};

const DEFAULT_STYLE: ExtensionStyle = {
  bg: "bg-slate-100",
  text: "text-slate-600",
  icon: <File size={16} />,
};

function getExtensionStyle(filename: string): ExtensionStyle {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_STYLES[ext] ?? DEFAULT_STYLE;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function FileRow({
  document,
  onDownload,
  onRename,
  onDelete,
  onMove,
  onOpen,
  selected = false,
  onToggleSelect,
}: FileRowProps) {
  const style = getExtensionStyle(document.display_name);
  const menuRef = useRef<ContextMenuHandle>(null);

  const menuItems: ContextMenuItem[] = [
    {
      label: "Download",
      icon: <Download size={14} />,
      onClick: () => onDownload(document),
    },
    {
      label: "Rename",
      icon: <Pencil size={14} />,
      onClick: () => onRename(document),
    },
    {
      label: "Move",
      icon: <Move size={14} />,
      onClick: () => onMove(document),
    },
    {
      label: "Delete",
      icon: <Trash2 size={14} />,
      onClick: () => onDelete(document),
      danger: true,
    },
  ];

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${onOpen ? "cursor-pointer" : ""} ${selected ? "bg-indigo-50" : ""}`}
      onClick={onOpen ? () => onOpen(document) : undefined}
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
          onChange={() => onToggleSelect(document.file_id)}
          className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 flex-shrink-0 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          aria-label={`Select ${document.display_name}`}
        />
      )}
      {/* File Type Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg} ${style.text}`}
        aria-hidden="true"
      >
        {style.icon}
      </div>
      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {document.display_name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatBytes(document.file_size)} &middot;{" "}
          {formatDate(document.uploaded_at)}
        </p>
      </div>
      <div className="hidden sm:block text-xs text-slate-400 flex-shrink-0 max-w-[140px] truncate">
        {document.uploaded_by_name}
      </div>
      <ContextMenu items={menuItems} ref={menuRef} />
    </div>
  );
}
