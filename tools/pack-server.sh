#!/usr/bin/env bash
# Builds the server and packs dist/wildlinge-server.tar.gz for Ubuntu 24.04.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd server && cargo build --release)
out=dist/wildlinge-deploy
rm -rf "$out" && mkdir -p "$out"
cp server/target/release/wildlinge-server "$out/"
cp dist/wildlinge.html "$out/"
mkdir -p "$out/static" && cp web/static/* "$out/static/"
cp deploy/install.sh deploy/wildlinge.service deploy/nginx.conf.template "$out/"
tar -C dist -czf dist/wildlinge-server.tar.gz wildlinge-deploy
ls -la dist/wildlinge-server.tar.gz
