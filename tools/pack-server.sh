#!/usr/bin/env bash
# Builds the server and packs dist/wildlinge-server.tar.gz for Ubuntu 24.04.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd server && cargo build --release)
out=dist/wildlinge-deploy
rm -rf "$out" && mkdir -p "$out"
cp server/target/release/wildlinge-server "$out/"
cp deploy/install.sh deploy/wildlinge.service deploy/poster.py deploy/wildlinge-poster.service deploy/wildlinge-poster.timer deploy/poster.env.example "$out/"
tar -C dist -czf dist/wildlinge-server.tar.gz wildlinge-deploy
ls -la dist/wildlinge-server.tar.gz
