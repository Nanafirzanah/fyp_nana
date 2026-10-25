import { describe, it, expect } from "vitest";
import {
  displayPath,
  ensureFolderPath,
  runPool,
  isIgnoredName,
  itemsFromFileList,
  partitionSupported,
  singleTopFolder,
  type FolderApi,
  type FolderCache,
  type UploadItem,
} from "./uploadItems";

function fakeFile(name: string, relativePath?: string): File {
  const file = new File(["x"], name);
  if (relativePath !== undefined) {
    Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  }
  return file;
}

function item(name: string, folderPath: string[] = []): UploadItem {
  return { file: fakeFile(name), folderPath };
}

describe("itemsFromFileList", () => {
  it("treats plain files as having no folder", () => {
    const items = itemsFromFileList([fakeFile("a.pdf"), fakeFile("b.txt", "")]);
    expect(items.map((i) => i.folderPath)).toEqual([[], []]);
  });

  it("reads the folder path from webkitRelativePath", () => {
    const [a, b] = itemsFromFileList([
      fakeFile("q1.pdf", "Reports/2026/q1.pdf"),
      fakeFile("readme.txt", "Reports/readme.txt"),
    ]);
    expect(a.folderPath).toEqual(["Reports", "2026"]);
    expect(b.folderPath).toEqual(["Reports"]);
    expect(displayPath(a)).toBe("Reports/2026/q1.pdf");
  });
});

describe("partitionSupported", () => {
  it("keeps supported types and reports the unsupported extensions", () => {
    const { supported, unsupportedExtensions } = partitionSupported([
      item("a.PDF"),
      item("b.exe"),
      item("c.exe"),
      item("noext"),
      item("d.docx"),
    ]);
    expect(supported.map((i) => i.file.name)).toEqual(["a.PDF", "d.docx"]);
    expect(unsupportedExtensions.sort()).toEqual(["(no extension)", ".exe"]);
  });

  it("silently drops operating-system housekeeping files", () => {
    const { supported, unsupportedExtensions } = partitionSupported([
      item(".DS_Store"),
      item("Thumbs.db"),
      item("desktop.ini"),
      item("~$draft.docx"),
      item("real.txt"),
    ]);
    expect(supported.map((i) => i.file.name)).toEqual(["real.txt"]);
    expect(unsupportedExtensions).toEqual([]);
    expect(isIgnoredName("THUMBS.DB")).toBe(true);
  });
});

describe("singleTopFolder", () => {
  it("returns the folder name when everything is in one folder", () => {
    expect(
      singleTopFolder([item("a.txt", ["Reports"]), item("b.txt", ["Reports", "x"])]),
    ).toBe("Reports");
  });

  it("returns null for loose files or several folders", () => {
    expect(singleTopFolder([item("a.txt")])).toBeNull();
    expect(singleTopFolder([item("a.txt", ["A"]), item("b.txt", ["B"])])).toBeNull();
  });
});

describe("ensureFolderPath", () => {
  function makeApi(existing: Record<string, { folder_id: string; name: string }[]> = {}) {
    const created: { name: string; parent?: string }[] = [];
    const listCalls: (string | undefined)[] = [];
    let n = 0;
    const api: FolderApi = {
      list: async (parentId) => {
        listCalls.push(parentId);
        return existing[parentId ?? "root"] ?? [];
      },
      create: async (name, parentId) => {
        created.push({ name, parent: parentId });
        return { folder_id: `new-${++n}` };
      },
    };
    return { api, created, listCalls };
  }

  it("returns the starting folder for an empty path without any calls", async () => {
    const { api, created, listCalls } = makeApi();
    expect(await ensureFolderPath([], "start", api, new Map())).toBe("start");
    expect(created).toEqual([]);
    expect(listCalls).toEqual([]);
  });

  it("creates the missing chain, each folder under the previous one", async () => {
    const { api, created } = makeApi();
    let reported = 0;
    const id = await ensureFolderPath(
      ["Reports", "2026"],
      undefined,
      api,
      new Map(),
      () => reported++,
    );
    expect(created).toEqual([
      { name: "Reports", parent: undefined },
      { name: "2026", parent: "new-1" },
    ]);
    expect(id).toBe("new-2");
    expect(reported).toBe(2);
  });

  it("reuses an existing folder instead of creating a duplicate", async () => {
    const { api, created } = makeApi({
      root: [{ folder_id: "existing-1", name: "Reports" }],
    });
    const id = await ensureFolderPath(["Reports"], undefined, api, new Map());
    expect(id).toBe("existing-1");
    expect(created).toEqual([]);
  });

  it("uses the cache so files in the same folder cost no extra calls", async () => {
    const { api, created, listCalls } = makeApi();
    const cache: FolderCache = new Map();
    const first = await ensureFolderPath(["A", "B"], "base", api, cache);
    const second = await ensureFolderPath(["A", "B"], "base", api, cache);
    const sibling = await ensureFolderPath(["A", "C"], "base", api, cache);
    expect(second).toBe(first);
    expect(sibling).not.toBe(first);
    expect(created.map((c) => c.name)).toEqual(["A", "B", "C"]);
    // Only the first lookup (under "base") hits the API: folders created during
    // this upload are empty, so their children are created without listing.
    expect(listCalls.length).toBe(1);
  });

  it("keeps same-named folders under different parents apart", async () => {
    const { api, created } = makeApi();
    const cache: FolderCache = new Map();
    const a = await ensureFolderPath(["X"], "p1", api, cache);
    const b = await ensureFolderPath(["X"], "p2", api, cache);
    expect(a).not.toBe(b);
    expect(created.length).toBe(2);
  });
});

describe("runPool", () => {
  it("never runs more than `limit` workers at once and keeps the input order", async () => {
    let running = 0;
    let peak = 0;
    const results = await runPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 10 - n));
      running--;
      return n * 10;
    });
    expect(peak).toBe(3);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80,
    ]);
  });

  it("captures a failure per item without stopping the others", async () => {
    const results = await runPool(["a", "boom", "c"], 2, async (v) => {
      if (v === "boom") throw new Error("failed");
      return v.toUpperCase();
    });
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect((results[1] as PromiseRejectedResult).reason.message).toBe("failed");
  });

  it("handles an empty list", async () => {
    expect(await runPool([], 4, async () => 1)).toEqual([]);
  });
});
