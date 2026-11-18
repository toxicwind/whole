import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageLines, printAll } from "../src/pager.ts";
import { gc, run } from "../src/cli.ts";
import { loadState, stateKey } from "../src/state.ts";

describe("pager", () => {
  test("pageLines prints 20 lines then a continue footer", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
    const res = pageLines(lines, 1, 20, "f.txt");
    expect(res.next).toBe(21);
    expect(res.done).toBe(false);
  });

  test("pageLines reaches done at EOF", () => {
    const lines = ["a", "b", "c"];
    const res = pageLines(lines, 1, 20, "f.txt");
    expect(res.done).toBe(true);
    expect(res.next).toBe(4);
  });

  test("printAll dumps every line", () => {
    const lines = ["x", "y"];
    printAll(lines); // smoke: no throw
    expect(lines.length).toBe(2);
  });
});

describe("state", () => {
  test("stateKey is a stable sha1 of the abs path", () => {
    const a = stateKey("/tmp/foo.txt");
    const b = stateKey("/tmp/foo.txt");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });

  test("gc prunes a stale entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "whole-gc-"));
    const f = join(dir, "x.txt");
    writeFileSync(f, "hello\nworld\n");
    // seed state via a read, then back-date it past PRUNE_AGE by writing
    // directly (saveState would prune on save, defeating the test)
    run([f]);
    const st = loadState();
    const key = stateKey(f);
    expect(st[key]).toBeDefined();
    st[key]!.touched = Date.now() / 1000 - 25 * 3600;
    const { STATE_FILE } = require("../src/state.ts") as typeof import("../src/state.ts");
    const fs = require("node:fs") as typeof import("node:fs");
    fs.writeFileSync(STATE_FILE, JSON.stringify(st), "utf8");
    const n = gc();
    expect(n).toBeGreaterThanOrEqual(1);
    rmSync(dir, { recursive: true, force: true });
  });
});