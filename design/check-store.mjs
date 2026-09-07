import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = process.argv[2] || fileURLToPath(new URL('../docs/store/', import.meta.url));
for (const [name, width, height] of [
  ['promo-small.png', 440, 280],
  ['screenshot-gallery.png', 1280, 800],
  ['screenshot-images.png', 1280, 800],
]) {
  const png = readFileSync(join(dir, name));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]], [width, height, 8, 2], `${name}: サイズ・8bit RGB（透過なし）を確認`);
}
console.log('ストア画像3枚: サイズ・PNG形式 OK');
