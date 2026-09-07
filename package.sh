#!/bin/sh
# Chromeウェブストア提出用のZIPを更新する。
set -e
cd "$(dirname "$0")"
out=docs/MornXReference.zip
rm -f "$out"
zip -q "$out" manifest.json background.js content.js lib.js icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png
echo "$out"
