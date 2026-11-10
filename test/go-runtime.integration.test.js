import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("real Go time.Sleep completes with a frozen Workers-style clock", { timeout: 60_000 }, () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), "tailnet-clock-"));
  try {
    const wasm = join(temp, "clock.wasm");
    const build = spawnSync("go", ["build", "-o", wasm, "../testdata/frozen-clock/main.go"], {
      cwd: join(root, "go"), env: { ...process.env, GOOS: "js", GOARCH: "wasm" }, encoding: "utf8", timeout: 40_000,
    });
    assert.equal(build.status, 0, build.stderr);
    const run = (mode) => spawnSync(process.execPath, [join(root, "testdata/frozen-clock/run.mjs"), wasm, mode], {
      encoding: "utf8", timeout: 2_000, stdio: ["ignore", "pipe", "ignore"],
    });
    const original = run("original");
    assert.notEqual(original.status, 0, "unmodified Go runtime unexpectedly handled the frozen clock");
    assert.ok(!original.stdout.includes("AWAKE"));
    const adapted = run("adapted");
    assert.equal(adapted.status, 0, String(adapted.error));
    assert.match(adapted.stdout, /AWAKE/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
