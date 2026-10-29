#!/usr/bin/env bash
# Builds the Rust core to WebAssembly and bundles everything into dist/wildlinge.html
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
[ -d node_modules ] || npm ci --no-audit --no-fund
if rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown && [ -z "${WL_BUILD_STD:-}" ]; then
  (cd core && cargo build --release --target wasm32-unknown-unknown)
else
  (cd core && RUSTC_BOOTSTRAP=1 RUSTFLAGS="-Zunstable-options -Cpanic=immediate-abort" cargo build --release --target wasm32-unknown-unknown -Zbuild-std=std,panic_abort)
fi
cp core/target/wasm32-unknown-unknown/release/wildlinge_core.wasm dist/wildlinge_core.wasm
if [ -x node_modules/.bin/wasm-opt ]; then
  node_modules/.bin/wasm-opt -O3 --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext --enable-mutable-globals dist/wildlinge_core.wasm -o dist/wildlinge_core.wasm
fi
node tools/bundle.mjs
