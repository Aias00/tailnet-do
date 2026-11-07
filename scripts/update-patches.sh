#!/bin/sh
# Regenerate patches/<name>/ from commits made on top of the pinned
# submodule commit in vendor/<name>. Commit your changes in the submodule
# first, then run this.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
for name in "$@"; do
  sub="vendor/$name"
  base=$(git ls-tree HEAD "$sub" | awk '{print $3}')
  [ -n "$base" ] || base=$(git -C "$sub" rev-parse HEAD)
  rm -f "patches/$name"/*.patch
  mkdir -p "patches/$name"
  git -C "$sub" format-patch -q --full-index -k --no-signature --no-stat --zero-commit \
    -o "$root/patches/$name" "$base"..HEAD
  ls "patches/$name"
done
