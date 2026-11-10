import { readFile } from "node:fs/promises";
import { configureGoRuntime } from "../../src/go-runtime.js";

Date.now = () => 1_000;
Object.defineProperty(globalThis, "performance", { value: { now: () => 0 }, configurable: true });
await import("../../src/wasm_exec.js");
const go = new Go();
if (process.argv[3] === "adapted") configureGoRuntime(go);
const { instance } = await WebAssembly.instantiate(await readFile(process.argv[2]), go.importObject);
go.run(instance);
console.log(await globalThis.fixtureSleep());
process.exit(0);
