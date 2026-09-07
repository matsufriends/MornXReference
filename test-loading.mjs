// Playwright が解決できる環境で node test-loading.mjs を実行する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as lib from './lib.js';

// 並列保存で投稿を失わず、失敗した取得は次回リトライする。
const store = {};
let fetches = 0;
let fail = false;
const background = readFileSync(process.env.BACKGROUND_SOURCE || new URL('./background.js', import.meta.url), 'utf8');
const fetchTweet = runInNewContext(background.replace(/^import .*;\n/, '') + '\nfetchTweet;', {
  ...lib,
  AbortSignal,
  chrome: {
    action: { onClicked: { addListener() {} } },
    runtime: { onMessage: { addListener() {} } },
    storage: { local: {
      async get(key) { return structuredClone({ [key]: store[key] }); },
      async set(value) { Object.assign(store, structuredClone(value)); },
    } },
  },
  fetch: async () => {
    fetches++;
    return { ok: !fail, json: async () => ({ mediaDetails: [{ type: 'photo', media_url_https: 'https://media.test/image' }] }) };
  },
});
await Promise.all(Array.from({ length: 20 }, (_, i) => fetchTweet(`https://x.com/test/status/${i + 1}`)));
assert.equal(Object.keys(store).length, 20, '並列取得した20件が個別に保存される');
await fetchTweet('https://x.com/test/status/1');
assert.equal(fetches, 20, 'キャッシュ済み投稿は再取得しない');
fail = true;
await fetchTweet('https://x.com/test/status/999');
fail = false;
assert.equal((await fetchTweet('https://x.com/test/status/999')).error, null, '失敗を永続キャッシュしない');
console.log('並列キャッシュ・再試行 OK');

const { chromium } = createRequire(import.meta.url)('playwright');
const source = readFileSync(process.env.CONTENT_SOURCE || new URL('./content.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const requests = [];
  await page.route('https://media.test/**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"/>' });
  });
  await page.route('https://x.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<body style="background:white;color:black"></body>' }));
  await page.goto('https://x.com/i/history');
  const elapsed = await page.evaluate((source) => {
    const saved = { mornXReferenceList: [], mornXReferenceCache: {} };
    for (let i = 0; i < 1000; i++) {
      const id = String(1234567890123456789n + BigInt(i));
      const href = `https://x.com/test/status/${id}`;
      const post = { author: `author${i}`, text: '', media: [{ kind: 'image', src: `https://media.test/${i}` }] };
      saved.mornXReferenceList.push(href);
      if (i % 2) saved[`mornXReferenceTweet:${id}`] = post;
      else saved.mornXReferenceCache[href] = post;
    }
    window.calls = [];
    window.filterScans = 0;
    const queryAll = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function (selector) {
      if (selector === '.mxr-tile') window.filterScans++;
      return queryAll.call(this, selector);
    };
    window.chrome = {
      storage: { local: { get: (key, cb) => cb(key === null || key === 'mornXReferenceList' ? saved : {}), set() {} } },
      runtime: { sendMessage: (message, callback) => window.calls.push({ message, callback }) },
    };
    window.eval(source.split('// --- boot')[0] + `
      window.gallery = { startCollection, closeOverlay, openOverlay, fetchOne };
    `);
    const start = performance.now();
    window.gallery.startCollection();
    return Promise.resolve().then(() => performance.now() - start);
  }, source);
  assert.equal(await page.locator('.mxr-tile').count(), 1000);
  assert.equal(await page.evaluate(() => window.calls.length), 0, '保存済み1000件はメッセージで再取得しない');
  assert.equal(await page.evaluate(() => window.filterScans), 0, '追加ごとに全タイルを走査しない');
  await page.waitForFunction(() => document.querySelector('.mxr-media').hasAttribute('src'));
  const loaded = await page.locator('.mxr-media[src]').count();
  assert.ok(loaded > 0 && loaded < 100, `画面内だけ読み込む: ${loaded}`);
  const last = page.locator('.mxr-media').last();
  assert.equal(await last.getAttribute('src'), null);
  await last.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.mxr-media')].at(-1).hasAttribute('src'));
  assert.ok(requests.length < 100, `画像リクエストが全件発生しない: ${requests.length}`);
  await page.locator('.mxr-search').fill('author999');
  assert.equal(await page.locator('.mxr-tile:visible').count(), 1);
  // 閉じた一覧の返答が、新しい一覧へ混入しない。同時取得枠も解放される。
  const queue = await page.evaluate(() => {
    const { gallery, calls } = window;
    for (let i = 0; i < 10; i++) gallery.fetchOne(`https://x.com/test/status/${i + 1}`, true);
    const initial = calls.length;
    calls[0].callback({ error: true });
    const afterOne = calls.length;
    gallery.closeOverlay();
    gallery.openOverlay();
    gallery.fetchOne('https://x.com/test/status/99', true);
    const post = { media: [{ kind: 'image', src: 'https://media.test/new' }] };
    calls[1].callback(post);
    const afterClose = calls.length;
    calls[2].callback(post);
    calls[3].callback(post);
    calls[4].callback(post);
    const staleTiles = document.querySelectorAll('.mxr-tile').length;
    calls[5].callback(post);
    return { initial, afterOne, afterClose, staleTiles, finalTiles: document.querySelectorAll('.mxr-tile').length };
  });
  assert.deepEqual(queue, { initial: 4, afterOne: 5, afterClose: 6, staleTiles: 0, finalTiles: 1 });
  console.log(`1000件復元 ${Math.round(elapsed)}ms / 初期メディア ${loaded}件 / スクロール・検索・取得制限・閉じ直し OK`);
} finally {
  await browser.close();
}
