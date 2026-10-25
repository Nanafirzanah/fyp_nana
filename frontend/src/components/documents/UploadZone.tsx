/**
 * Drag & Drop upload zone for files and whole folders.
 * Click to browse files, or use "upload a folder" to pick a folder.
 */

import { useRef, useState } from "react";
import { Upload, Loader2, FolderUp } from "lucide-react";
import { toast } from "sonner";
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILES_PER_UPLOAD,
  itemsFromDataTransfer,
  itemsFromFileList,
  partitionSupported,
  type UploadItem,
} from "../../utils/uploadItems";

interface UploadZoneProps {
  onUpload: (items: UploadItem[]) => void;
  uploading: boolean;
}

// `webkitdirectory` is not in React's typings but is supported by all major browsers.
const FOLDER_INPUT_ATTRS = { webkitdirectory: "", directory: "" } as Record<
  string,
  string
>;

export default function UploadZone({ onUpload, uploading }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function handleItems(items: UploadItem[]) {
    if (uploading) return;

    const { supported, unsupportedExtensions } = partitionSupported(items);

    if (unsupportedExtensions.length > 0) {
      toast.error(
        `File format not supported: ${unsupportedExtensions.join(",")}`,
      );
    }
    if (supported.length > MAX_FILES_PER_UPLOAD) {
      toast.error(
        `Too many files: ${supported.length}. The limit is ${MAX_FILES_PER_UPLOAD} files per upload.`,
      );
      return;
    }
    if (supported.length) onUpload(supported);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    try {
      const items = await itemsFromDataTransfer(e.dataTransfer);
      if (items.length) handleItems(items);
    } catch (err) {
      console.error(err);
      toast.error("Could not read the dropped files. Try again.");
    }
  }

  return (
    <div
      onClick={() => !uploading && fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer select-none ${uploading ? "border-slate-200 bg-slate-50 cursor-not-allowed" : isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) handleItems(itemsFromFileList(files));
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        {...FOLDER_INPUT_ATTRS}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) handleItems(itemsFromFileList(files));
        }}
      />

      <div className="flex flex-col items-center gap-2">
        {uploading ? (
          <>
            <Loader2
              size={28}
              className="text-blue-500 animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-600">Uploading...</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Upload
                size={18}
                className="text-blue-500"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                <span className="text-blue-600">Click to upload</span> or drag
                and drop files or a folder
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PDF, DOCX, TXT, XLSX, CSV, PPTX, PNG, JPEG
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <FolderUp size={14} aria-hidden="true" />
              Upload a folder
            </button>
          </>
        )}
      </div>
    </div>
  );
}
