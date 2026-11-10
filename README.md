# tailnet-do

Fork status: [experimental Workers runtime fixes](docs/runtime-investigation.md).
Local regression tests pass; deployed outbound forwarding is not yet reliable.

Put a Cloudflare Durable Object on your Tailscale tailnet. The object becomes a normal tailnet device with its own `100.x` address. It can serve HTTP or TCP to your other devices, dial into private machines, and act as an exit node or subnet router.

Under the hood this is Tailscale's own userspace client (WireGuard, netstack, DERP) compiled to WebAssembly. The control plane and DERP relays are reached over outbound WebSockets. Traffic that leaves an exit node goes out through `cloudflare:sockets`.

```js
import { TailnetObject } from "tailnet-do";

export class Node extends TailnetObject {
  async onTailnet(tailnet) {
    // Tailnet-only HTTP. `who` says which user and device is calling.
    tailnet.serve(80, (req, who) => new Response(`hi ${who.loginName}`));
  }
}

export default {
  async fetch(req, env) {
    const node = env.NODE.getByName("main");
    // Reach a private machine from a plain Worker, through the DO.
    return node.tailnetFetch("http://homelab:8080/status");
  },
};
```

Set `TS_AUTHKEY` (and optionally `TS_HOSTNAME`, `TS_CONTROL_URL`) as secrets. Without an auth key, the node starts an interactive login and puts the URL in `status().loginURL`.

## API

Inside a Durable Object, `Tailnet.start(ctx, options)` returns a node. `TailnetObject` wraps it for you.

- `connect("host:port")` opens TCP to a tailnet host. It returns a socket shaped like `cloudflare:sockets`, and MagicDNS names work.
- `fetch(url, init)` is HTTP over the tailnet.
- `serve(port, (request, who) => Response)` is an HTTP server on the node's tailnet address.
- `listen(port, (socket, who) => {})` accepts raw TCP.
- `whois("ip:port")`, `status()`, `ready()` and `logout()` do what their names say.

Options: `authKey`, `hostname`, `controlURL`, `ephemeral`, `tags`, `exitNode`, `advertiseRoutes`, `dohURL`, `keepAlive`, `statePrefix`, `onLog`.

`TailnetObject` also exposes `tailnetConnect`, `tailnetFetch` and `tailnetStatus` as RPC methods, so Workers without their own node can use the tailnet through a DO stub.

## Limits

- An exit node only forwards TCP, plus DNS answered over DoH. Workers have no UDP sockets, so QUIC falls back to TCP. Outbound port 25 is blocked, and outbound sockets to Cloudflare IP ranges may be blocked.
- A Durable Object lives in one location, so traffic exits from where the object was created. Use `locationHint` to place exit nodes in specific regions.

## Layout and building

- `go/` holds the Go engine: a js/wasm main built against the vendored Tailscale tree.
- `vendor/tailscale` is a git submodule pinned to the tested commit.
- `patches/tailscale/` holds our changes to Tailscale as `git format-patch` files.
- `src/` is the JS library. `src/tailnet.wasm` is a build output.
- `examples/exit-node/` is an exit node that also serves a page on the tailnet.

```sh
git submodule update --init --depth 1
npm run build                      # apply patches, then build src/tailnet.wasm
cd examples/exit-node && npx wrangler dev
```

To change Tailscale, start from a clean pinned checkout, run `git -C vendor/tailscale am ../../patches/tailscale/*.patch`, and add your commits on top. Then run `./scripts/update-patches.sh tailscale` to regenerate `patches/tailscale/`.

## Runtime checks

The browser WebSocket dependency is pinned and patched so its `error` handler
returns before waiting for the subsequent `close` event. Blocking that callback
can deadlock the JavaScript event loop and terminate the Go/WASM engine.

HTTP-only netcheck probes are limited to four regions (eight requests per round)
to leave room for control-plane and relay traffic under Workers Free's
50-subrequest limit. This caps measurements, not the regions available for
peer relay connections.

After applying patches (`npm run patch`), run the real Go/WASM WebSocket
regression with Node.js 22 or newer and Go installed. It checks that the original
dependency deadlocks on a simulated browser error while the patched build
returns the read error and remains responsive:

```sh
npm test
cd go
GOOS=js GOARCH=wasm go test -exec="$(go env GOROOT)/lib/wasm/go_js_wasm_exec" .
cd ../vendor/tailscale
go test ./net/netcheck -run '^TestHTTPProbeLimit$'
```
