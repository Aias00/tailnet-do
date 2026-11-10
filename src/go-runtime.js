// Workers can keep Date.now() frozen between I/O events, including timer wakeups.
export function configureGoRuntime(go, {
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let clock = now();
  const readClock = () => (clock = Math.max(clock, now()));
  const imports = go.importObject.gojs;

  imports["runtime.nanotime1"] = (sp) => {
    go.mem.setBigInt64((sp >>> 0) + 8, BigInt(Math.trunc(readClock())) * 1_000_000n, true);
  };
  imports["runtime.scheduleTimeoutEvent"] = (sp) => {
    sp >>>= 0;
    const id = go._nextCallbackTimeoutID++;
    const delay = Math.max(0, Number(go.mem.getBigInt64(sp + 8, true)));
    let deadline = readClock() + delay;
    const resume = () => {
      if (!go._scheduledTimeouts.has(id) || go.exited) return;
      clock = Math.max(readClock(), deadline);
      go._resume();
      // Never spin synchronously if Go hasn't acknowledged a timer yet.
      if (go._scheduledTimeouts.has(id)) {
        deadline = readClock() + 1;
        go._scheduledTimeouts.set(id, setTimer(resume, 1));
      }
    };
    go._scheduledTimeouts.set(id, setTimer(resume, delay));
    go.mem.setInt32(sp + 16, id, true);
  };
  imports["runtime.clearTimeoutEvent"] = (sp) => {
    const id = go.mem.getInt32((sp >>> 0) + 8, true);
    clearTimer(go._scheduledTimeouts.get(id));
    go._scheduledTimeouts.delete(id);
  };
}
