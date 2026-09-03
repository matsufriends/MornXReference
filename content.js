// Adds a "ギャラリー" button next to X's logo (top-left). Clicking it starts
// collecting media from the bookmarks list and shows it in an in-page overlay
// covering the area right of the sidebar (no dedicated tab/page).

const STYLE_ID = 'mxr-style';
const GALLERY_LABEL = 'ギャラリー';
// X はブックマーク一覧を /i/history (履歴 > ブックマーク) へ移した。旧パスも残す。
const BOOKMARK_PATHS = ['/i/history', '/i/bookmarks'];
const BOOKMARK_URL = '/i/history#mornxref';

let overlayEl = null;
// 上部バーの設定。chrome.storage.local に保存して次回も引き継ぐ
const SETTINGS_KEY = 'mornXReferenceSettings';
const settings = { tile: 220, muted: true };
chrome.storage.local.get(SETTINGS_KEY, (r) => Object.assign(settings, r[SETTINGS_KEY] || {}));
function saveSettings() {
  chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
let started = false;
const seen = new Set();
let fetchedCount = 0;

// --- gallery button ----------------------------------------------------
// サイドバー項目の複製は X の再描画や選択状態のたびにズレるので、左上の X ロゴの右隣に
// 自前の固定ボタンを置く (ロゴの位置だけ参照し、X の DOM には触らない)。

const GRID_ICON_PATH = 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z';
let buttonEl = null;

function ensureGalleryButton() {
  if (buttonEl && document.body.contains(buttonEl)) return;
  injectStyle();
  buttonEl = document.createElement('button');
  buttonEl.type = 'button';
  buttonEl.className = 'mxr-button';
  buttonEl.title = GALLERY_LABEL;
  buttonEl.setAttribute('aria-label', GALLERY_LABEL);
  buttonEl.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="${GRID_ICON_PATH}"/></svg><span class="mxr-button-label">${GALLERY_LABEL}</span>`;
  buttonEl.addEventListener('click', onGalleryClick);
  document.body.appendChild(buttonEl);
  placeGalleryButton();
}

// 「ポストする」ボタンの直下に同じ幅で置く (サイドバーが細い時は丸いアイコンだけになる)。
// 縦幅が狭くて下のアカウント表示と重なる場合は、左上のロゴの右隣へ逃がす。
function placeGalleryButton() {
  if (!buttonEl) return;
  const header = 'header[role="banner"] ';
  const post = document.querySelector(`${header}a[data-testid="SideNav_NewTweet_Button"]`);
  const account = document.querySelector(`${header}[data-testid="SideNav_AccountSwitcher_Button"]`);
  const logo = document.querySelector(`${header}h1 a[href="/home"]`);
  let rect = null;
  if (post) {
    const r = post.getBoundingClientRect();
    const height = Math.min(r.height, 52);
    rect = { left: r.left, top: r.bottom + 8, width: r.width, height };
    const a = account && account.getBoundingClientRect();
    if (a && a.height > 0 && rect.top + height > a.top - 8) rect = null;
  }
  if (!rect && logo) {
    const r = logo.getBoundingClientRect();
    rect = { left: r.right + 8, top: r.top + (r.height - 40) / 2, width: 40, height: 40 };
  }
  if (!rect) rect = { left: 8, top: 8, width: 40, height: 40 };
  buttonEl.style.left = `${rect.left}px`;
  buttonEl.style.top = `${rect.top}px`;
  buttonEl.style.width = `${rect.width}px`;
  buttonEl.style.height = `${rect.height}px`;
  buttonEl.style.color = getComputedStyle(document.body).color;
  buttonEl.querySelector('.mxr-button-label').style.display = rect.width > 80 ? '' : 'none';
  buttonEl.classList.toggle('mxr-button-on', !!overlayEl);
}

function onGalleryClick(e) {
  e.preventDefault();
  if (overlayEl) return;
  if (BOOKMARK_PATHS.includes(location.pathname)) {
    location.hash = '#mornxref';
    startCollection();
  } else {
    location.href = BOOKMARK_URL;
  }
}

// --- collection ---------------------------------------------------------

function findPermalink(article) {
  const links = article.querySelectorAll('a[href*="/status/"]');
  for (const a of links) {
    if (a.querySelector('time')) return a.href;
  }
  for (const a of links) {
    if (/\/status\/\d+$/.test(a.href)) return a.href;
  }
  return null;
}

function hasMedia(article) {
  return !!(
    article.querySelector('video') ||
    article.querySelector('[data-testid="videoPlayer"]') ||
    article.querySelector('[data-testid="tweetPhoto"]')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectNew() {
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    if (!hasMedia(article)) continue;
    const href = findPermalink(article);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    fetchOne(href);
  }
  updateProgress();
}

function fetchOne(href) {
  chrome.runtime.sendMessage({ type: 'fetchTweet', url: href }, (res) => {
    fetchedCount++;
    addTile(href, res);
    updateProgress();
  });
}

async function startCollection() {
  if (started) return;
  started = true;
  openOverlay();

  let stableCount = 0;
  let lastHeight = -1;
  for (let i = 0; i < 300 && overlayEl; i++) {
    collectNew();
    window.scrollTo(0, document.scrollingElement.scrollHeight);
    await sleep(1500);

    const height = document.scrollingElement.scrollHeight;
    if (height === lastHeight) {
      stableCount++;
      if (stableCount >= 3) break;
    } else {
      stableCount = 0;
      lastHeight = height;
    }
  }
  collectNew();
}

// --- overlay --------------------------------------------------------------

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mxr-overlay, .mxr-overlay :where(*:not(input)) { all: initial; box-sizing: border-box; font-family: system-ui, sans-serif; color: var(--mxr-fg); }
    .mxr-overlay { --mxr-line: color-mix(in srgb, var(--mxr-fg) 30%, transparent); --mxr-soft: color-mix(in srgb, var(--mxr-fg) 8%, transparent); }
    .mxr-overlay input { font: 13px system-ui, sans-serif; color: var(--mxr-fg); background: var(--mxr-soft); border: 1px solid var(--mxr-line); border-radius: 6px; padding: 5px 8px; }
    .mxr-overlay input[type="range"] { padding: 0; border: 0; background: none; width: 140px; }
    .mxr-overlay input[type="search"] { width: 240px; }
    .mxr-overlay input[type="date"] { color-scheme: light dark; }
    .mxr-button { all: initial; position: fixed; z-index: 2147483646; border-radius: 9999px; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-sizing: border-box; font: 700 17px system-ui, sans-serif; }
    .mxr-button-label { color: inherit; }
    .mxr-button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
    .mxr-button-on { background: color-mix(in srgb, currentColor 15%, transparent); }
    .mxr-tilde { font-size: 13px; opacity: .7; }
    .mxr-lightbox { position: absolute; inset: 0; z-index: 2147483647; background: color-mix(in srgb, var(--mxr-bg) 92%, transparent); display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; cursor: zoom-out; }
    .mxr-lightbox video, .mxr-lightbox img { max-width: 96%; max-height: calc(100% - 60px); display: block; object-fit: contain; cursor: default; }
    .mxr-kinds { display: inline-flex; border: 1px solid var(--mxr-line); border-radius: 6px; overflow: hidden; }
    .mxr-kind { cursor: pointer; font-size: 13px; background: var(--mxr-soft); padding: 6px 12px; }
    .mxr-kind-on { color: var(--mxr-bg); background: var(--mxr-fg); }
    .mxr-overlay { position: fixed; top: 0; right: 0; bottom: 0; left: var(--mxr-left, 0); z-index: 2147483647; background: var(--mxr-bg); color: var(--mxr-fg); display: flex; flex-direction: column; }
    .mxr-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; flex: none; }
    .mxr-close { cursor: pointer; font-size: 18px; line-height: 1; background: var(--mxr-soft); border: 1px solid var(--mxr-line); border-radius: 6px; padding: 6px 12px; }
    .mxr-tile-size { cursor: pointer; }
    .mxr-sound { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer; white-space: nowrap; }
    .mxr-sound-check { padding: 0; border: 0; background: none; cursor: pointer; }
    .mxr-progress { font-size: 13px; opacity: .7; margin-left: auto; }
    .mxr-grid { flex: 1; overflow: auto; padding: 4px; display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--mxr-tile, 220px), 1fr)); gap: 4px; align-content: start; }
    .mxr-tile { display: block; }
    .mxr-media { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: contain; background: var(--mxr-soft); cursor: zoom-in; }
    .mxr-tile-link { display: inline-block; font-size: 12px; color: #1d9bf0; text-decoration: underline; cursor: pointer; padding: 2px 4px 4px; }
    .mxr-foot { display: flex; align-items: center; gap: 8px; }
    .mxr-info, .mxr-tile-info { font-size: 12px; opacity: .7; }
    .mxr-tile-info { margin-left: 6px; }
    .mxr-link { font-size: 14px; padding: 6px 0; color: #1d9bf0; text-decoration: underline; cursor: pointer; }
  `;
  document.head.appendChild(style);
}

function openOverlay() {
  injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'mxr-overlay';
  // X のカラーテーマ (白 / ダークブルー / 黒) をそのまま引き継ぐ
  const bodyStyle = getComputedStyle(document.body);
  overlay.style.setProperty('--mxr-bg', bodyStyle.backgroundColor);
  overlay.style.setProperty('--mxr-fg', bodyStyle.color);
  // 画面全体ではなく、サイドバー (header) の右側だけを覆う
  const fitToSidebar = () => {
    const header = document.querySelector('header[role="banner"]');
    overlay.style.setProperty('--mxr-left', `${header ? header.getBoundingClientRect().right : 0}px`);
  };
  fitToSidebar();
  window.addEventListener('resize', fitToSidebar);
  overlay.innerHTML = `
    <div class="mxr-bar">
      <button class="mxr-close" type="button" aria-label="閉じる">&times;</button>
      <input class="mxr-tile-size" type="range" min="60" max="480" value="${settings.tile}" />
      <label class="mxr-sound"><input class="mxr-sound-check" type="checkbox" ${settings.muted ? '' : 'checked'} /> 音を出す</label>
      <span class="mxr-kinds">
        <button class="mxr-kind mxr-kind-on" type="button" data-kind="">全部</button>
        <button class="mxr-kind" type="button" data-kind="image">画像</button>
        <button class="mxr-kind" type="button" data-kind="video">動画</button>
      </span>
      <input class="mxr-search" type="search" placeholder="文字で絞り込み" />
      <input class="mxr-from" type="date" title="この日から" />
      <span class="mxr-tilde">〜</span>
      <input class="mxr-to" type="date" title="この日まで" />
      <span class="mxr-progress"></span>
    </div>
    <div class="mxr-grid"></div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.mxr-grid').style.setProperty('--mxr-tile', `${settings.tile}px`);
  overlay.querySelector('.mxr-close').addEventListener('click', closeOverlay);
  overlay.querySelector('.mxr-tile-size').addEventListener('input', (e) => {
    settings.tile = Number(e.target.value);
    overlay.querySelector('.mxr-grid').style.setProperty('--mxr-tile', `${settings.tile}px`);
    saveSettings();
  });
  overlay.querySelector('.mxr-sound-check').addEventListener('change', (e) => {
    // グリッドは常にミュート。音は拡大表示の動画だけ
    settings.muted = !e.target.checked;
    for (const v of overlay.querySelectorAll('.mxr-lightbox video')) v.muted = settings.muted;
    saveSettings();
  });
  for (const btn of overlay.querySelectorAll('.mxr-kind')) {
    btn.addEventListener('click', () => {
      for (const b of overlay.querySelectorAll('.mxr-kind')) b.classList.toggle('mxr-kind-on', b === btn);
      applyFilter();
    });
  }
  for (const sel of ['.mxr-search', '.mxr-from', '.mxr-to']) {
    overlay.querySelector(sel).addEventListener('input', applyFilter);
  }
  overlayEl = overlay;
  placeGalleryButton();
  updateProgress();
}

function applyFilter() {
  if (!overlayEl) return;
  const kind = overlayEl.querySelector('.mxr-kind-on').dataset.kind;
  const query = overlayEl.querySelector('.mxr-search').value.trim().toLowerCase();
  const from = overlayEl.querySelector('.mxr-from').value;
  const to = overlayEl.querySelector('.mxr-to').value;
  for (const tile of overlayEl.querySelectorAll('.mxr-tile')) {
    const d = tile.dataset.date;
    const show =
      (!kind || tile.dataset.kind === kind) &&
      (!query || tile.dataset.text.includes(query)) &&
      (!from || d >= from) &&
      (!to || d <= to);
    tile.style.display = show ? '' : 'none';
  }
}

function closeOverlay() {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  started = false;
  seen.clear();
  fetchedCount = 0;
  placeGalleryButton();
  history.replaceState(null, '', location.pathname + location.search);
}

function openLightbox(media, href, res) {
  const box = document.createElement('div');
  box.className = 'mxr-lightbox';
  let el;
  if (media.kind === 'video') {
    el = document.createElement('video');
    el.src = media.src;
    el.autoplay = true;
    el.loop = true;
    el.controls = true;
    el.muted = settings.muted;
  } else {
    el = document.createElement('img');
    el.src = media.src;
  }
  el.addEventListener('click', (e) => e.stopPropagation());
  box.appendChild(el);
  const link = document.createElement('a');
  link.className = 'mxr-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '元ポスト';
  link.addEventListener('click', (e) => e.stopPropagation());
  const info = document.createElement('span');
  info.className = 'mxr-info';
  info.textContent = postInfo(res, tweetDate(href));
  const foot = document.createElement('div');
  foot.className = 'mxr-foot';
  foot.append(link, info);
  box.appendChild(foot);
  const close = () => {
    box.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  box.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  overlayEl.appendChild(box);
}

function updateProgress() {
  if (!overlayEl) return;
  overlayEl.querySelector('.mxr-progress').textContent = `収集 ${seen.size} / 取得 ${fetchedCount}`;
}

// ポスト ID (Snowflake) から投稿日 (ローカル日付 YYYY-MM-DD) を得る。API 応答に依存しない。
function tweetDate(href) {
  const m = href.match(/\/status\/(\d+)/);
  if (!m) return '';
  const ms = Number(BigInt(m[1]) >> 22n) + 1288834974657;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 「元ポスト」リンクの後ろに、作者と投稿日を添える
function postInfo(res, date) {
  const author = res && res.author ? `@${res.author}` : '';
  return [author, date.replace(/-/g, '/')].filter(Boolean).join(' ');
}

function addTile(href, res) {
  if (!overlayEl || !res || res.error || !res.media) return;
  const grid = overlayEl.querySelector('.mxr-grid');
  const text = `${res.author || ''} ${res.text || ''}`.toLowerCase();
  const date = tweetDate(href);
  for (const media of res.media) {
    const tile = document.createElement('div');
    tile.className = 'mxr-tile';
    tile.dataset.kind = media.kind === 'video' ? 'video' : 'image';
    tile.dataset.text = text;
    tile.dataset.date = date;
    const el = document.createElement(media.kind === 'video' ? 'video' : 'img');
    el.className = 'mxr-media';
    el.src = media.src;
    if (media.kind === 'video') {
      el.autoplay = true;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.preload = 'metadata';
      if (media.poster) el.poster = media.poster;
    }
    el.addEventListener('click', () => openLightbox(media, href, res));
    tile.appendChild(el);
    const link = document.createElement('a');
    link.className = 'mxr-tile-link';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '元ポスト';
    tile.appendChild(link);
    const info = document.createElement('span');
    info.className = 'mxr-tile-info';
    info.textContent = postInfo(res, date);
    tile.appendChild(info);
    grid.appendChild(tile);
  }
  applyFilter();
}

// --- boot -----------------------------------------------------------------

ensureGalleryButton();
new MutationObserver(() => {
  ensureGalleryButton();
  placeGalleryButton();
  // X 内の画面遷移 (SPA) でブックマーク一覧を離れたらギャラリーも閉じる
  if (overlayEl && !BOOKMARK_PATHS.includes(location.pathname)) closeOverlay();
}).observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', () => {
  if (overlayEl && !BOOKMARK_PATHS.includes(location.pathname)) closeOverlay();
});
window.addEventListener('resize', placeGalleryButton);

if (BOOKMARK_PATHS.includes(location.pathname) && location.hash === '#mornxref') {
  startCollection();
}
