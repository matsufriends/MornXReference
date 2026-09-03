#!/bin/sh
# ストア申請用の ZIP を作る。実行後 ~/Desktop に MornXReference-<version>.zip ができる
set -e
cd "$(dirname "$0")/.."
v=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
out=~/Desktop/MornXReference-$v.zip
rm -f "$out"
zip -q "$out" manifest.json background.js content.js lib.js icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png
echo "$out"
