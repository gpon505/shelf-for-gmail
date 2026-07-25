#!/bin/sh
# Builds a clean Chrome Web Store zip: dist/shelf-<version>.zip
# Ships only what the extension needs — no tools/, store/, docs, or dotfiles.
set -e
cd "$(dirname "$0")/.."

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUT="dist/shelf-$VERSION.zip"

mkdir -p dist
rm -f "$OUT"
zip -r "$OUT" \
  manifest.json \
  content.js \
  shelf.css \
  options.html \
  options.js \
  popup.html \
  popup.js \
  icons \
  -x '*.DS_Store'

echo ""
echo "Built $OUT:"
unzip -l "$OUT"
