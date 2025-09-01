#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
STATIC_DIR="$BACKEND_DIR/static"

echo "[clean] removing previous build outputs"
rm -rf "$STATIC_DIR" "$BACKEND_DIR/noet" || true

echo "[link] ensuring node_modules symlink to quill"
if [ ! -e "$FRONTEND_DIR/node_modules" ]; then
  ln -s ../../quill/node_modules "$FRONTEND_DIR/node_modules"
fi

echo "[frontend] building React app"
pushd "$FRONTEND_DIR" >/dev/null
npm run build
popd >/dev/null

echo "[backend] building Go binary"
pushd "$BACKEND_DIR" >/dev/null
mkdir -p .gocache .gotmp
GOCACHE="$BACKEND_DIR/.gocache" GOTMPDIR="$BACKEND_DIR/.gotmp" GOOS=${GOOS:-} GOARCH=${GOARCH:-} go build -o noet
popd >/dev/null

echo "[done] binary at $BACKEND_DIR/noet; assets embedded from $STATIC_DIR"
