import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/storage/json-store.js";

const tmpDir = path.join(os.tmpdir(), "agent-bridge-json-store-test");

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("JsonStore", () => {
  it("returns fallback when file does not exist", () => {
    const store = new JsonStore<{ x: number }>(
      path.join(tmpDir, `noexist-${Date.now()}.json`),
      { x: 42 },
    );
    expect(store.read()).toEqual({ x: 42 });
  });

  it("writes and reads back", () => {
    const filePath = path.join(tmpDir, `write-${Date.now()}.json`);
    const store = new JsonStore<{ items: string[] }>(filePath, { items: [] });
    store.write({ items: ["a", "b"] });
    expect(store.read()).toEqual({ items: ["a", "b"] });
  });

  it("update applies mutator and returns result", () => {
    const filePath = path.join(tmpDir, `update-${Date.now()}.json`);
    const store = new JsonStore<{ count: number }>(filePath, { count: 0 });
    const result = store.update((v) => ({ count: v.count + 1 }));
    expect(result).toEqual({ count: 1 });
    expect(store.read()).toEqual({ count: 1 });
  });

  it("uses atomic write (temp file + rename)", () => {
    const filePath = path.join(tmpDir, `atomic-${Date.now()}.json`);
    const store = new JsonStore<{ v: number }>(filePath, { v: 0 });
    store.write({ v: 99 });
    // No .tmp file should remain
    const tmpFile = `${filePath}.${process.pid}.tmp`;
    expect(fs.existsSync(tmpFile)).toBe(false);
    expect(store.read()).toEqual({ v: 99 });
  });

  it("handles malformed JSON gracefully", () => {
    const filePath = path.join(tmpDir, `malformed-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "{invalid json}", "utf-8");
    const store = new JsonStore<{ ok: boolean }>(filePath, { ok: true });
    expect(store.read()).toEqual({ ok: true });
  });
});
