import test from "node:test";
import assert from "node:assert/strict";
import { configureGoRuntime } from "./go-runtime.js";

function fixture(resume) {
  let time = 1_000;
  let nextTimer = 0;
  const timers = new Map();
  const go = {
    mem: new DataView(new ArrayBuffer(128)),
    importObject: { gojs: {} },
    _nextCallbackTimeoutID: 1,
    _scheduledTimeouts: new Map(),
    _resume: () => resume(go),
  };
  configureGoRuntime(go, {
    now: () => time,
    setTimer: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimer: (id) => timers.delete(id),
  });
  return {
    go, timers,
    advance: (value) => { time = value; },
    tick: () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); },
    clock: () => { go.importObject.gojs["runtime.nanotime1"](0); return go.mem.getBigInt64(8, true); },
    schedule: (delay) => {
      go.mem.setBigInt64(8, BigInt(delay), true);
      go.importObject.gojs["runtime.scheduleTimeoutEvent"](0);
      return go.mem.getInt32(16, true);
    },
  };
}

test("a timer advances Go's monotonic clock even when the host clock is frozen", () => {
  let calls = 0;
  const f = fixture((go) => {
    calls++;
    assert.equal(f.clock(), 1_025_000_000n);
    go._scheduledTimeouts.delete(1);
  });
  f.schedule(25);
  f.tick();
  assert.equal(calls, 1);
  assert.equal(f.timers.size, 0);
  f.advance(900);
  assert.equal(f.clock(), 1_025_000_000n);
});

test("unacknowledged wakeups yield instead of spinning in the callback", () => {
  let calls = 0;
  const f = fixture((go) => { if (++calls === 2) go._scheduledTimeouts.delete(1); });
  f.schedule(25);
  f.tick();
  assert.equal(calls, 1);
  assert.equal(f.timers.size, 1);
  f.tick();
  assert.equal(calls, 2);
  assert.equal(f.clock(), 1_026_000_000n);
});

test("canceled timers do not wake the engine", () => {
  const f = fixture(() => assert.fail("canceled timer fired"));
  const id = f.schedule(25);
  f.go.mem.setInt32(8, id, true);
  f.go.importObject.gojs["runtime.clearTimeoutEvent"](0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.go._scheduledTimeouts.size, 0);
});
