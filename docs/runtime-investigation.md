# Workers runtime investigation

## Confirmed failure mechanism

The browser implementation of `github.com/coder/websocket` v1.8.15 calls
`closeWithInternal()` synchronously from its JavaScript `error` listener.
`Close()` waits for `c.closed`, which is only closed by a later JavaScript
`close` event. The current callback cannot return until that event happens,
and JavaScript cannot dispatch that event until the callback returns.

The deployed fatal stack contains exactly this blocked callback:

```text
syscall/js.handleEvent
wsjs.WebSocket.addEventListener.func1
websocket.(*Conn).init.func2
websocket.(*Conn).closeWithInternal
websocket.(*Conn).Close
websocket.(*Conn).exportedClose
<-c.closed
```

An ordinary relay WebSocket error can therefore poison the Go/WASM engine,
followed by `Go program has already exited`, timeouts or CPU resets. This
identifies the failure mechanism, not why the relay emitted the initial error.

The patch runs the close handshake on a Go goroutine so the error callback
returns and the close event can be delivered. The dependency is pinned as a
submodule and patched reproducibly; the shared module cache is not modified.

## Regression evidence

`npm test` builds the same real Go/WASM WebSocket fixture twice. A fake browser
WebSocket opens, emits an error, and queues its close event as a microtask.

- Original v1.8.15: deterministic `all goroutines are asleep - deadlock!`, then
  `Go program has already exited`.
- Patched v1.8.15: the read returns its error and the process completes normally.

This test needs no account, private keys, live relay or external service.

## Independent request-budget issue

HTTP-only netcheck probes every eligible relay region twice. A 27-region map
can exceed Workers Free's 50-subrequest budget. The WASM host limits only
measurements to four regions (eight requests per round), preserving the full
relay map. Its test checks request counts and response-body closure.

## Ruled-out hypotheses

A temporary Cloudflare Durable Object ran standalone Go timers and gVisor TCP
dial timeouts both with and without the clock adapter. All four checks returned
successfully (about 25 ms for sleep and 50 ms for the dial).

A frozen-clock-only explanation does not account for the deployed failure.
The clock adapter, Promise-construction change and status-observer deferral
were reverted. The cross-request Promise resolution compatibility flag and
disabling Green Tea GC had also failed and were reverted.

## Integration status

Registration and inbound Tailnet HTTP have succeeded. With the WebSocket fix, two successive outbound requests timed out, but the
node remained Running and bounded diagnostics contained no fatal engine exit.
Forwarding is still blocked by the relay transport described below.

No account plan was upgraded and no client was switched to this exit node.

## Relay-specific evidence

The destination peer advertises a custom DERP region. Its map uses an IP-literal
HTTPS endpoint on port 8443 and a `sha256-raw` certificate pin. Native Tailscale
supports this pin in its TLS dialer. The browser WebSocket branch only passes
a URL and the `derp` subprotocol, with no certificate-pin verification hook.

A temporary Cloudflare Worker compared the relay WebSocket upgrades: the public
DERP endpoint returned 101, while the custom endpoint returned 403 and did not
upgrade. Local standard HTTPS validation also rejected the custom certificate
as untrusted. The 403 itself does not establish whether Cloudflare policy,
relay configuration, or certificate handling produced that response.

Deployed diagnostics repeatedly showed custom-region WebSocket dial errors
(`use of closed network connection`) and WireGuard handshake retries. Thus the
currently verified blocker is that relay's browser-WebSocket path. A native
TCP/TLS fallback was tried but did not activate for the observed route and was
removed rather than presented as a working fix. Proper options include a
publicly trusted WebSocket-capable relay endpoint or an independently verified
host-TCP path with correct certificate pinning. Neither requires disabling TLS
verification. No relay server or tailnet policy was changed.
