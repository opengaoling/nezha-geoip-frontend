#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 /path/to/nezha-geoip-panel" >&2
  exit 2
fi

frontend_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
panel_root="$1"
target_root="$panel_root/cmd/dashboard"

if [ ! -d "$target_root" ]; then
  echo "target panel directory not found: $target_root" >&2
  exit 1
fi

rm -rf "$target_root/admin-dist" "$target_root/user-dist"
mkdir -p "$target_root"
cp -a "$frontend_root/admin-dist" "$target_root/admin-dist"
cp -a "$frontend_root/user-dist" "$target_root/user-dist"

