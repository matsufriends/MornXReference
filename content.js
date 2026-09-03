// Injects a "ギャラリー" sidebar item next to X's own Bookmarks item. Clicking it
// starts collecting media from the bookmarks list and shows it in a full-screen
// in-page overlay (no dedicated tab/page).

const STYLE_ID = 'mxr-style';
const GALLERY_LABEL = 'ギャラリー';

let overlayEl = null;
let started = false;
const seen = new Set();
let fetchedCount = 0;

// --- sidebar item -----------------------------------------------------

function findSidebarRow(nav) {
  const link = nav.querySelector('a[href="/i/bookmarks"]');
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
  link.setAttribute('href', '/i/bookmarks#mornxref');
  link.setAttribute('aria-label', GALLERY_LABEL);
  for (const span of clone.querySelectorAll('span')) {
    if (span.textContent.trim()) span.textContent = GALLERY_LABEL;
  }
  link.addEventListener('click', onGalleryClick);
  row.after(clone);
}

function onGalleryClick(e) {
  e.preventDefault();
  if (overlayEl) return;
  if (location.pathname === '/i/bookmarks') {
    location.hash = '#mornxref';
    startCollection();
  } else {
    location.href = '/i/bookmarks#mornxref';
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
    .mxr-overlay, .mxr-overlay * { all: initial; box-sizing: border-box; font-family: system-ui, sans-serif; }
    .mxr-overlay { position: fixed; inset: 0; z-index: 2147483647; background: #000; color: #fff; display: flex; flex-direction: column; }
    .mxr-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; flex: none; }
    .mxr-close { cursor: pointer; font-size: 18px; line-height: 1; color: #fff; background: #222; border: 1px solid #555; border-radius: 6px; padding: 6px 12px; }
    .mxr-tile-size { cursor: pointer; }
    .mxr-progress { font-size: 13px; color: #ccc; margin-left: auto; }
    .mxr-grid { flex: 1; overflow: auto; padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--mxr-tile, 220px), 1fr)); gap: 8px; align-content: start; }
    .mxr-tile { background: #111; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
    .mxr-tile video, .mxr-tile img { width: 100%; display: block; object-fit: cover; aspect-ratio: 1 / 1; }
    .mxr-caption { display: block; font-size: 11px; color: #ddd; padding: 4px 6px; }
    .mxr-error { display: block; padding: 24px 8px; text-align: center; color: #888; font-size: 12px; }
    .mxr-link { display: block; font-size: 11px; color: #4ea1ff; padding: 0 6px 6px; text-decoration: underline; cursor: pointer; }
  `;
  document.head.appendChild(style);
}

function openOverlay() {
  injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'mxr-overlay';
  overlay.innerHTML = `
    <div class="mxr-bar">
      <button class="mxr-close" type="button" aria-label="閉じる">&times;</button>
      <input class="mxr-tile-size" type="range" min="120" max="480" value="220" />
      <span class="mxr-progress"></span>
    </div>
    <div class="mxr-grid"></div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.mxr-close').addEventListener('click', closeOverlay);
  overlay.querySelector('.mxr-tile-size').addEventListener('input', (e) => {
    overlay.style.setProperty('--mxr-tile', `${e.target.value}px`);
  });
  overlayEl = overlay;
  updateProgress();
}

function closeOverlay() {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  history.replaceState(null, '', location.pathname + location.search);
}

function updateProgress() {
  if (!overlayEl) return;
  overlayEl.querySelector('.mxr-progress').textContent = `収集 ${seen.size} / 取得 ${fetchedCount}`;
}

function addTile(href, res) {
  if (!overlayEl) return;
  const grid = overlayEl.querySelector('.mxr-grid');
  const tile = document.createElement('div');
  tile.className = 'mxr-tile';

  if (!res || res.error || !res.media || res.media.length === 0) {
    const error = document.createElement('div');
    error.className = 'mxr-error';
    error.textContent = '取得不可';
    tile.appendChild(error);
  } else {
    for (const media of res.media) {
      if (media.kind === 'video') {
        const video = document.createElement('video');
        video.src = media.src;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        if (media.poster) video.poster = media.poster;
        tile.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = media.src;
        tile.appendChild(img);
      }
    }
    const caption = document.createElement('span');
    caption.className = 'mxr-caption';
    const author = res.author ? `@${res.author} ` : '';
    caption.textContent = `${author}${(res.text || '').slice(0, 60)}`;
    tile.appendChild(caption);
  }

  const link = document.createElement('a');
  link.className = 'mxr-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '元ポスト';
  tile.appendChild(link);

  grid.appendChild(tile);
}

// --- boot -----------------------------------------------------------------

ensureGalleryItem();
new MutationObserver(ensureGalleryItem).observe(document.body, { childList: true, subtree: true });

if (location.pathname === '/i/bookmarks' && location.hash === '#mornxref') {
  startCollection();
}
