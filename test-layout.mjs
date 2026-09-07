// Playwright が解決できる環境で node test-layout.mjs を実行する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const source = readFileSync(process.argv[2] || new URL('./content.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.setContent('<body style="background:white;color:black"></body>');
  await page.evaluate((source) => {
    window.chrome = { storage: { local: { get: (_, cb) => cb({}), set: () => {} } } };
    // X への接続だけ省き、実際のオーバーレイ・タイル生成を使う。
    window.eval(source.split('// --- boot')[0] + `
      openOverlay();
      for (let i = 0; i < 30; i++) addTile('https://x.com/example/status/1234567890123456789', {
        author: 'very_long_author_name', text: '',
        media: [{ kind: i % 2 ? 'image' : 'video', src: i % 2 ? 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22/%3E' : '' }]
      }, false);
    `);
  }, source);
  for (const size of [480, 60, 220, 480, 60]) {
    await page.locator('.mxr-tile-size').evaluate((slider, size) => {
      slider.value = size;
      slider.dispatchEvent(new Event('input'));
    }, size);
    const tiles = await page.locator('.mxr-tile').evaluateAll((tiles) => tiles.map((tile) => {
      const media = tile.querySelector('.mxr-media').getBoundingClientRect();
      const caption = tile.querySelector('.mxr-tile-caption');
      const info = tile.querySelector('.mxr-tile-info');
      const range = document.createRange();
      range.selectNodeContents(info);
      return {
        height: tile.getBoundingClientRect().height, width: media.width, mediaHeight: media.height,
        captionHeight: caption?.getBoundingClientRect().height,
        clipped: caption && getComputedStyle(caption).overflow === 'hidden' && getComputedStyle(caption).textOverflow === 'ellipsis',
        lines: new Set([...range.getClientRects()].map((r) => r.top)).size,
      };
    }));
    assert.equal(tiles.length, 30);
    for (const tile of tiles) {
      assert.ok(tile.height >= tile.mediaHeight, `${size}px: タイルが画像より低い ${JSON.stringify(tile)}`);
      assert.ok(Math.abs(tile.width - tile.mediaHeight) < 1, `${size}px: メディアが正方形ではない ${JSON.stringify(tile)}`);
      assert.ok(tile.captionHeight > 0 && tile.captionHeight < 30 && tile.clipped, `${size}px: 文字の省略表示が無効`);
      assert.equal(tile.lines, 1, `${size}px: 投稿情報が折り返されている`);
    }
    console.log(`${size}px: 30 タイル OK`);
  }
} finally {
  await browser.close();
}
