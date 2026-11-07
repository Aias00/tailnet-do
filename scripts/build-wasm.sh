#!/bin/sh
# Build the Go engine to src/tailnet.wasm and refresh wasm_exec.js from the
# Go toolchain that built it (they must match).
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root/go"
GOOS=js GOARCH=wasm go build -tags "$(cat tags.txt)" -trimpath -ldflags "-s -w" -o "$root/src/tailnet.wasm" .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$root/src/wasm_exec.js"
ls -l "$root/src/tailnet.wasm" | awk '{print "src/tailnet.wasm", $5, "bytes"}'
