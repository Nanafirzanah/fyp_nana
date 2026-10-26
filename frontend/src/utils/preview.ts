/**
 * Which files can be previewed in the browser and how to show them.
 * Keep the extension list in step with backend/preview.py.
 */

export type PreviewKind = "pdf" | "image" | "text" | "csv";

const KINDS: Record<string, PreviewKind> = {
  ".pdf": "pdf",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".txt": "text",
  ".csv": "csv",
};

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** Most characters of a text or CSV file shown in the preview. */
export const MAX_TEXT_PREVIEW_CHARS = 200_000;

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

export function previewKind(filename: string): PreviewKind | null {
  return KINDS[extensionOf(filename)] ?? null;
}

/** MIME type to give a decrypted blob so the browser renders it (pdf and images). */
export function mimeForPreview(filename: string): string {
  return MIME[extensionOf(filename)] ?? "application/octet-stream";
}

export function truncateForPreview(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= MAX_TEXT_PREVIEW_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_TEXT_PREVIEW_CHARS), truncated: true };
}

/**
 * Small CSV parser: comma separated, double quotes with "" as an escaped quote,
 * quoted fields may contain commas and line breaks, LF or CRLF row endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
