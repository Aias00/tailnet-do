import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("a browser WebSocket error must not block its close event", { timeout: 60_000 }, () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), "tailnet-ws-"));
  const modTemp = mkdtempSync(join(root, "go/.ws-test-"));
  try {
    const mod = join(modTemp, "baseline.mod");
    writeFileSync(mod, readFileSync(join(root, "go/go.mod"), "utf8")
      .replace(/^replace github\.com\/coder\/websocket => .*\n?/m, ""));
    writeFileSync(join(modTemp, "baseline.sum"), readFileSync(join(root, "go/go.sum")));
    for (const mode of ["original", "fixed"]) {
      const wasm = join(temp, `${mode}.wasm`);
      const args = ["build", ...(mode === "original" ? [`-modfile=${mod}`] : []),
        "-o", wasm, "../testdata/websocket-error/main.go"];
      const build = spawnSync("go", args, {
        cwd: join(root, "go"), env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
        encoding: "utf8", timeout: 25_000,
      });
      assert.equal(build.status, 0, build.stderr);
      const run = spawnSync(process.execPath, [join(root, "testdata/websocket-error/run.mjs"), wasm], {
        encoding: "utf8", timeout: 3_000, maxBuffer: 64 * 1024,
      });
      if (mode === "original") {
        assert.notEqual(run.status, 0, "original error handler unexpectedly completed");
        assert.match(run.stdout + run.stderr, /deadlock|Go program has already exited/);
      } else {
        assert.equal(run.status, 0, run.stderr || String(run.error));
        assert.match(run.stdout, /AWAKE/);
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(modTemp, { recursive: true, force: true });
  }
});
