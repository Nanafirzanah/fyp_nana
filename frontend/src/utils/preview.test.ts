import { describe, it, expect } from "vitest";
import {
  MAX_TEXT_PREVIEW_CHARS,
  mimeForPreview,
  parseCsv,
  previewKind,
  truncateForPreview,
} from "./preview";

describe("previewKind", () => {
  it("recognises the previewable types, ignoring case", () => {
    expect(previewKind("Report.PDF")).toBe("pdf");
    expect(previewKind("a.png")).toBe("image");
    expect(previewKind("a.JPG")).toBe("image");
    expect(previewKind("a.jpeg")).toBe("image");
    expect(previewKind("notes.txt")).toBe("text");
    expect(previewKind("data.csv")).toBe("csv");
  });

  it("returns null for types that are download-only", () => {
    for (const name of ["a.docx", "a.xlsx", "a.pptx", "a.html", "a.svg", "noext", ""]) {
      expect(previewKind(name)).toBeNull();
    }
  });

  it("uses the last extension of a dotted name", () => {
    expect(previewKind("archive.v2.final.pdf")).toBe("pdf");
  });
});

describe("mimeForPreview", () => {
  it("gives pdf and image blobs a type the browser can render", () => {
    expect(mimeForPreview("a.pdf")).toBe("application/pdf");
    expect(mimeForPreview("a.PNG")).toBe("image/png");
    expect(mimeForPreview("a.jpeg")).toBe("image/jpeg");
    expect(mimeForPreview("a.docx")).toBe("application/octet-stream");
  });
});

describe("truncateForPreview", () => {
  it("leaves short text alone and cuts long text with a flag", () => {
    expect(truncateForPreview("hello")).toEqual({ text: "hello", truncated: false });
    const long = "x".repeat(MAX_TEXT_PREVIEW_CHARS + 10);
    const out = truncateForPreview(long);
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBe(MAX_TEXT_PREVIEW_CHARS);
  });
});

describe("parseCsv", () => {
  it("parses simple rows with LF and CRLF endings", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps the last row when there is no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quoted fields with commas, escaped quotes and line breaks", () => {
    expect(parseCsv('name,note\n"Ali, Bin","said ""hi"""\n"x","line1\nline2"')).toEqual([
      ["name", "note"],
      ["Ali, Bin", 'said "hi"'],
      ["x", "line1\nline2"],
    ]);
  });

  it("keeps empty fields and handles an empty file", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([["a", "", "c"], ["", "", ""]]);
    expect(parseCsv("")).toEqual([]);
  });
});
