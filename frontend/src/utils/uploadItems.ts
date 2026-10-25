/**
 * Helpers for uploading files and whole folders.
 *
 * An UploadItem is a file plus the folder path it sits in, relative to where the
 * user dropped or picked it (empty for a plain file). Folders are recreated on
 * the server through the normal create-folder API, then the files are uploaded
 * into them.
 */

export interface UploadItem {
  file: File;
  /** Folder names from the picked folder down to the file's parent. */
  folderPath: string[];
}

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
];

/** Largest number of files accepted in one upload (a folder counts every file). */
export const MAX_FILES_PER_UPLOAD = 200;

const IGNORED_NAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

/** Operating-system housekeeping files that nobody means to upload. */
export function isIgnoredName(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IGNORED_NAMES.has(lower) || lower.startsWith("~$");
}

export function displayPath(item: UploadItem): string {
  return [...item.folderPath, item.file.name].join("/");
}

/**
 * Items from a file input. For a folder pick (`webkitdirectory`) every file has
 * `webkitRelativePath` such as "Reports/2026/q1.pdf".
 */
export function itemsFromFileList(files: File[]): UploadItem[] {
  return files.map((file) => {
    const relative = file.webkitRelativePath;
    const parts = relative ? relative.split("/").filter(Boolean) : [];
    return { file, folderPath: parts.slice(0, -1) };
  });
}

function readAllEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
        } else {
          all.push(...batch);
          readBatch();
        }
      }, reject);
    readBatch();
  });
}

async function walkEntry(
  entry: FileSystemEntry,
  path: string[],
  out: UploadItem[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ file, folderPath: path });
  } else if (entry.isDirectory) {
    const children = await readAllEntries(
      (entry as FileSystemDirectoryEntry).createReader(),
    );
    for (const child of children) {
      await walkEntry(child, [...path, entry.name], out);
    }
  }
}

/** Items from a drop event; understands dropped folders (any depth). */
export async function itemsFromDataTransfer(
  dt: DataTransfer,
): Promise<UploadItem[]> {
  // Entries must be taken synchronously: the event data is gone after an await.
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) return itemsFromFileList(Array.from(dt.files));

  const out: UploadItem[] = [];
  for (const entry of entries) {
    await walkEntry(entry, [], out);
  }
  return out;
}

/** Split into supported items and ones skipped for their file type. */
export function partitionSupported(items: UploadItem[]): {
  supported: UploadItem[];
  unsupportedExtensions: string[];
} {
  const supported: UploadItem[] = [];
  const unsupported = new Set<string>();
  for (const item of items) {
    if (isIgnoredName(item.file.name)) continue;
    const ext = getExtension(item.file.name);
    if (ACCEPTED_EXTENSIONS.includes(ext)) {
      supported.push(item);
    } else {
      unsupported.add(ext || "(no extension)");
    }
  }
  return { supported, unsupportedExtensions: Array.from(unsupported) };
}

/** Name of the single top-level folder when everything came from one folder. */
export function singleTopFolder(items: UploadItem[]): string | null {
  const tops = new Set(items.map((i) => i.folderPath[0] ?? ""));
  if (tops.size !== 1) return null;
  const [top] = Array.from(tops);
  return top || null;
}

export interface FolderApi {
  list: (parentId?: string) => Promise<{ folder_id: string; name: string }[]>;
  create: (name: string, parentId?: string) => Promise<{ folder_id: string }>;
}

export interface CachedFolder {
  id: string;
  /** true when this upload created the folder (so it is empty). */
  isNew: boolean;
}

export type FolderCache = Map<string, CachedFolder>;

/**
 * Make sure every folder in `path` exists under `rootParentId`, reusing a folder
 * with the same name instead of creating a duplicate. Returns the id of the last
 * folder (or `rootParentId` for an empty path). `cache` makes repeated calls for
 * files in the same folder free, and `onCreate` reports each folder created.
 */
export async function ensureFolderPath(
  path: string[],
  rootParentId: string | undefined,
  api: FolderApi,
  cache: FolderCache,
  onCreate?: () => void,
): Promise<string | undefined> {
  let parent = rootParentId;
  let parentIsNew = false;
  let key = rootParentId ?? "";
  for (const name of path) {
    key = `${key}/${name}`;
    let entry = cache.get(key);
    if (!entry) {
      // A folder created during this upload is empty, so its children cannot exist yet.
      const existing: { folder_id: string; name: string } | undefined =
        parentIsNew
        ? undefined
        : (await api.list(parent)).find((f) => f.name === name);
      if (existing) {
        entry = { id: existing.folder_id, isNew: false };
      } else {
        const created = await api.create(name, parent);
        onCreate?.();
        entry = { id: created.folder_id, isNew: true };
      }
      cache.set(key, entry);
    }
    parent = entry.id;
    parentIsNew = entry.isNew;
  }
  return parent;
}

/**
 * Run `worker` over `items` with at most `limit` running at once. Results keep
 * the input order; a failure is captured per item and never stops the others.
 */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => lane()),
  );
  return results;
}
