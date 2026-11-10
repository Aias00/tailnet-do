# Workers runtime investigation

Status: experimental fix branch; outbound forwarding is not yet reliable on
the deployed Workers runtime. Passing local tests is not an end-to-end fix.

## Reproduced and covered

- Workers-style frozen clocks prevent unmodified Go timers from completing.
  `npm test` compiles a real Go/WASM timer, runs the original runtime with a
  frozen host clock in a bounded subprocess, and checks the adapter completes
  the same timer. Other tests cover monotonicity, cancellation and asynchronous
  retry instead of a synchronous spin.
- HTTP-only netcheck probes every eligible region twice. A 27-region map can
  exceed Workers Free's 50-subrequest budget before normal application work.
  The WASM host caps measurements at four regions. The upstream default is
  unchanged for other hosts. The patch test checks request count and response
  body closure.
- Promise resolution, rejection, undefined results and concurrent callbacks
  are covered by Go/WASM tests.

## Candidate safeguards

The bridge uses native Promise resolvers rather than a Go callback as a
synchronous Promise constructor executor. Status observers are deferred until
the Go notification callback returns. These remove synchronous reentry paths,
but have not independently been proved to fix the deployed fatal error.

## Integration evidence and remaining failure

Registration succeeds, the node reaches Running, and a Tailnet peer can fetch
the node's HTTP service and receive its verified caller identity.

Outbound HTTP forwarding to a reachable Tailnet service has not passed.
Observed failures include request timeouts, `Durable Object exceeded its CPU
time limit and was reset`, and Go/WASM `unexpected signal during runtime
execution` followed by `Go program has already exited`. Fatal stacks included
runtime allocation and event callback handling. This does not prove the
allocator itself is the root cause.

Disabling Green Tea GC and the Cloudflare cross-request Promise resolution
compatibility flag did not resolve the failure; those experiments were reverted.
No account-plan upgrade or client exit-node selection was performed.

Further work should isolate cold-start readiness from steady-state TCP dialing
and collect a CPU profile or bounded Go stack sample before the reset. The
frozen-clock test and request-budget fix should remain independently testable.
