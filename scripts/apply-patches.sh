#!/bin/sh
# Apply patches/<name>/*.patch to vendor/<name>, on top of the pinned
# submodule commit. Safe to re-run: already-applied patch sets are skipped.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
git submodule update --init --depth 1 >/dev/null
for dir in patches/*/; do
  name=$(basename "$dir")
  sub="vendor/$name"
  set -- "$root/$dir"*.patch
  [ -e "$1" ] || continue
  if git -C "$sub" apply --reverse --check "$@" 2>/dev/null; then
    echo "$sub: patches already applied"
    continue
  fi
  git -C "$sub" apply --whitespace=nowarn "$@"
  echo "$sub: applied $# patch(es)"
done
