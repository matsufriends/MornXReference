// Playwright が解決できる環境で node design/export-screenshots.mjs を実行する。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const source = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const images = Array.from({ length: 6 }, (_, i) => 'data:image/png;base64,' + readFileSync(new URL(`./samples/sample-${i}.png`, import.meta.url)).toString('base64'));
const video = 'data:video/webm;base64,' + readFileSync(new URL('./samples/sample-video.webm', import.meta.url)).toString('base64');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ja-JP' });
  await page.setContent('<body style="background:white;color:#0f1419"></body>');
  await page.evaluate(({ source, images, video }) => {
    window.chrome = { storage: { local: { get: (_, cb) => cb({}), set() {} } } };
    window.samples = { images, video };
    // X のページ読み取りだけ省き、実際のギャラリーUIにサンプル投稿を渡す。
    window.eval(source.split('// --- boot')[0] + `
      settings.tile = 180;
      openOverlay();
      for (let i = 0; i < 18; i++) {
        const href = 'https://x.com/sample/status/' + (2093479129325305856n + BigInt(i));
        seen.add(href);
        const isVideo = i % 6 === 0;
        addTile(href, {
          author: isVideo ? 'sample_video' : 'sample_art', text: 'サンプル作品',
          media: [{ kind: isVideo ? 'video' : 'image', src: isVideo ? samples.video : samples.images[i % 6], poster: samples.images[0] }]
        }, false);
      }
      updateProgress();
    `);
  }, { source, images, video });
  await page.waitForFunction(() => [...document.querySelectorAll('.mxr-media')].every((el) => el.tagName === 'VIDEO' ? el.readyState >= 2 : el.complete && el.naturalWidth > 0));
  await page.screenshot({ path: fileURLToPath(new URL('../docs/store/screenshot-gallery.png', import.meta.url)) });
  await page.locator('.mxr-kind[data-kind="image"]').click();
  await page.screenshot({ path: fileURLToPath(new URL('../docs/store/screenshot-images.png', import.meta.url)) });
} finally {
  await browser.close();
}
