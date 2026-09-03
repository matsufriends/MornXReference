// Injects a "ギャラリー" sidebar item next to X's own Bookmarks item. Clicking it
// starts collecting media from the bookmarks list and shows it in a full-screen
// in-page overlay (no dedicated tab/page).

const STYLE_ID = 'mxr-style';
const GALLERY_LABEL = 'ギャラリー';
// X はブックマーク一覧を /i/history (履歴 > ブックマーク) へ移した。旧パスも残す。
const BOOKMARK_PATHS = ['/i/history', '/i/bookmarks'];
const BOOKMARK_URL = '/i/history#mornxref';

let overlayEl = null;
let started = false;
const seen = new Set();
let fetchedCount = 0;

// --- sidebar item -----------------------------------------------------

// X のサイドバーは設定次第でブックマーク項目が無いので、候補を順に探す。
const ROW_CANDIDATES = ['/i/bookmarks', '/i/history', '/explore', '/home'];
const GRID_ICON_PATH = 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z';

function isActiveRow(link) {
  const span = [...link.querySelectorAll('span')].find((el) => el.textContent.trim());
  return !!span && Number(getComputedStyle(span).fontWeight) >= 600;
}

function findSidebarRow(nav) {
  const links = ROW_CANDIDATES.map((h) => nav.querySelector(`a[href="${h}"]`)).filter(Boolean);
  // 現在地の項目 (太字) を複製すると「ギャラリー」が常に選択中の見た目になるので避ける
  const link = links.find((l) => !isActiveRow(l)) || links[0];
  if (!link) return null;
  let node = link;
  while (node.parentElement && node.parentElement !== nav) {
    node = node.parentElement;
  }
  return node.parentElement === nav ? node : link;
}

function ensureGalleryItem() {
  const nav = document.querySelector('nav[role="navigation"]');
  if (!nav || nav.querySelector('[data-mornxref]')) return;
  const row = findSidebarRow(nav);
  if (!row) return;

  const clone = row.cloneNode(true);
  clone.dataset.mornxref = '1';
  const link = clone.matches('a') ? clone : clone.querySelector('a');
  if (!link) return;
  link.setAttribute('href', BOOKMARK_URL);
  link.setAttribute('aria-label', GALLERY_LABEL);
  link.removeAttribute('aria-current');
  for (const span of clone.querySelectorAll('span')) {
    if (span.textContent.trim()) span.textContent = GALLERY_LABEL;
  }
  const svg = clone.querySelector('svg');
  if (svg) svg.innerHTML = `<g><path d="${GRID_ICON_PATH}"></path></g>`;
  link.addEventListener('click', onGalleryClick);
  row.after(clone);
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
  for (let i = 0; i < 300; i++) {
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
    .mxr-lightbox { position: fixed; inset: 0; z-index: 2147483647; background: color-mix(in srgb, var(--mxr-bg) 92%, transparent); display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
    .mxr-lightbox video, .mxr-lightbox img { max-width: 96vw; max-height: 96vh; display: block; object-fit: contain; cursor: default; }
    .mxr-kinds { display: inline-flex; border: 1px solid var(--mxr-line); border-radius: 6px; overflow: hidden; }
    .mxr-kind { cursor: pointer; font-size: 13px; background: var(--mxr-soft); padding: 6px 12px; }
    .mxr-kind-on { color: var(--mxr-bg); background: var(--mxr-fg); }
    .mxr-overlay { position: fixed; inset: 0; z-index: 2147483647; background: var(--mxr-bg); color: var(--mxr-fg); display: flex; flex-direction: column; }
    .mxr-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; flex: none; }
    .mxr-close { cursor: pointer; font-size: 18px; line-height: 1; background: var(--mxr-soft); border: 1px solid var(--mxr-line); border-radius: 6px; padding: 6px 12px; }
    .mxr-tile-size { cursor: pointer; }
    .mxr-progress { font-size: 13px; opacity: .7; margin-left: auto; }
    .mxr-grid { flex: 1; overflow: auto; padding: 4px; display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--mxr-tile, 220px), 1fr)); gap: 4px; align-content: start; }
    .mxr-tile { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: contain; background: var(--mxr-soft); cursor: zoom-in; }
    .mxr-link { position: fixed; left: 16px; bottom: 16px; font-size: 13px; color: #1d9bf0; text-decoration: underline; cursor: pointer; }
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
  overlay.innerHTML = `
    <div class="mxr-bar">
      <button class="mxr-close" type="button" aria-label="閉じる">&times;</button>
      <input class="mxr-tile-size" type="range" min="120" max="480" value="220" />
      <span class="mxr-kinds">
        <button class="mxr-kind mxr-kind-on" type="button" data-kind="">全部</button>
        <button class="mxr-kind" type="button" data-kind="image">画像</button>
        <button class="mxr-kind" type="button" data-kind="video">動画</button>
      </span>
      <input class="mxr-search" type="search" placeholder="文字で絞り込み" />
      <span class="mxr-progress"></span>
    </div>
    <div class="mxr-grid"></div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.mxr-close').addEventListener('click', closeOverlay);
  overlay.querySelector('.mxr-tile-size').addEventListener('input', (e) => {
    overlay.querySelector('.mxr-grid').style.setProperty('--mxr-tile', `${e.target.value}px`);
  });
  for (const btn of overlay.querySelectorAll('.mxr-kind')) {
    btn.addEventListener('click', () => {
      for (const b of overlay.querySelectorAll('.mxr-kind')) b.classList.toggle('mxr-kind-on', b === btn);
      applyFilter();
    });
  }
  overlay.querySelector('.mxr-search').addEventListener('input', applyFilter);
  overlayEl = overlay;
  updateProgress();
}

function applyFilter() {
  if (!overlayEl) return;
  const kind = overlayEl.querySelector('.mxr-kind-on').dataset.kind;
  const query = overlayEl.querySelector('.mxr-search').value.trim().toLowerCase();
  for (const tile of overlayEl.querySelectorAll('.mxr-tile')) {
    const show = (!kind || tile.dataset.kind === kind) && (!query || tile.dataset.text.includes(query));
    tile.style.display = show ? '' : 'none';
  }
}

function closeOverlay() {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  history.replaceState(null, '', location.pathname + location.search);
}

function openLightbox(media, href) {
  const box = document.createElement('div');
  box.className = 'mxr-lightbox';
  let el;
  if (media.kind === 'video') {
    el = document.createElement('video');
    el.src = media.src;
    el.autoplay = true;
    el.loop = true;
    el.controls = true;
    el.muted = true;
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
  box.appendChild(link);
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

function addTile(href, res) {
  if (!overlayEl || !res || res.error || !res.media) return;
  const grid = overlayEl.querySelector('.mxr-grid');
  const text = `${res.author || ''} ${res.text || ''}`.toLowerCase();
  for (const media of res.media) {
    const el = document.createElement(media.kind === 'video' ? 'video' : 'img');
    el.className = 'mxr-tile';
    el.dataset.kind = media.kind === 'video' ? 'video' : 'image';
    el.dataset.text = text;
    el.src = media.src;
    if (media.kind === 'video') {
      el.autoplay = true;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.preload = 'metadata';
      if (media.poster) el.poster = media.poster;
    }
    el.addEventListener('click', () => openLightbox(media, href));
    grid.appendChild(el);
  }
  applyFilter();
}

// --- boot -----------------------------------------------------------------

ensureGalleryItem();
new MutationObserver(ensureGalleryItem).observe(document.body, { childList: true, subtree: true });

if (BOOKMARK_PATHS.includes(location.pathname) && location.hash === '#mornxref') {
  startCollection();
}
