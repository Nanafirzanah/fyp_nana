import { FolderOpen } from "lucide-react";
import type { Document, Folder } from "../../types";
import FolderRow from "./FolderRow";
import FileRow from "./FileRow";

interface ContentListProps {
  folders: Folder[];
  files: Document[];
  isInsideFolder: boolean;
  onFolderOpen: (folderId: string) => void;
  onFolderRename: (folder: Folder) => void;
  onFolderDelete: (folder: Folder) => void;
  onFileDownload: (document: Document) => void;
  onFileRename: (document: Document) => void;
  onFileDelete: (document: Document) => void;
  onFileOpen?: (document: Document) => void;
  selectedFileIds?: Set<string>;
  selectedFolderIds?: Set<string>;
  onToggleFileSelect?: (fileId: string) => void;
  onToggleFolderSelect?: (folderId: string) => void;
  onFileMove: (document: Document) => void;
  onFolderMove: (folder: Folder) => void;
}

export default function ContentList({
  folders,
  files,
  isInsideFolder,
  onFolderOpen,
  onFolderRename,
  onFolderDelete,
  onFileDownload,
  onFileRename,
  onFileDelete,
  onFileOpen,
  selectedFileIds,
  selectedFolderIds,
  onToggleFileSelect,
  onToggleFolderSelect,
  onFileMove,
  onFolderMove,
}: ContentListProps) {
  const isEmpty = folders.length === 0 && files.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <FolderOpen size={22} className="text-slate-400" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-slate-500">
          {isInsideFolder ? "This folder is empty" : "No documents yet"}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {isInsideFolder
            ? "Upload a file"
            : "Create a folder or upload a file"}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {/* Folders */}
      {folders.map((folder) => (
        <FolderRow
          key={folder.folder_id}
          folder={folder}
          onOpen={onFolderOpen}
          onRename={onFolderRename}
          onDelete={onFolderDelete}
          onMove={onFolderMove}
          selected={selectedFolderIds?.has(folder.folder_id)}
          onToggleSelect={onToggleFolderSelect}
        />
      ))}

      {/* Divider between folders and files */}
      {folders.length > 0 && files.length > 0 && (
        <div className="px-4 py-1.5 bg-slate-50">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Files
          </p>
        </div>
      )}

      {/* Files */}
      {files.map((file) => (
        <FileRow
          key={file.file_id}
          document={file}
          onDownload={onFileDownload}
          onRename={onFileRename}
          onDelete={onFileDelete}
          onOpen={onFileOpen}
          onMove={onFileMove}
          selected={selectedFileIds?.has(file.file_id)}
          onToggleSelect={onToggleFileSelect}
        />
      ))}
    </div>
  );
}
