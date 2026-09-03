import { buildSyndicationUrl, extractTweetMedia } from './lib.js';

const STORAGE_KEY = 'mornXReferenceItems';

const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

// ponytail: no chrome.storage under file:// — localStorage keeps the page usable there.
async function loadItems() {
  if (hasChromeStorage) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

async function saveItems(items) {
  if (hasChromeStorage) {
    await chrome.storage.local.set({ [STORAGE_KEY]: items });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

async function fetchTweet(item) {
  if (!item.tweetId) {
    item.error = '取得不可';
    return;
  }
  try {
    const res = await fetch(buildSyndicationUrl(item.tweetId));
    if (!res.ok) {
      item.error = '取得不可';
      return;
    }
    const json = await res.json();
    const media = extractTweetMedia(json);
    if (!media || media.media.length === 0) {
      item.error = '取得不可';
      return;
    }
    item.author = media.author;
    item.text = media.text;
    item.media = media.media;
  } catch {
    item.error = '取得不可';
  }
}

function renderTile(item) {
  const tile = document.createElement('div');
  tile.className = 'tile';

  if (item.error) {
    const err = document.createElement('div');
    err.className = 'error';
    err.textContent = item.error;
    tile.appendChild(err);
  } else if (item.media && item.media.length > 0) {
    for (const m of item.media) {
      if (m.kind === 'video') {
        const video = document.createElement('video');
        video.src = m.src;
        if (m.poster) video.poster = m.poster;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        tile.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = m.src;
        tile.appendChild(img);
      }
    }
  }

  const caption = document.createElement('div');
  caption.className = 'caption';
  const author = item.author ? `@${item.author}` : '';
  const text = item.text ? item.text.slice(0, 60) : '';
  caption.textContent = [author, text].filter(Boolean).join(' — ');
  tile.appendChild(caption);

  const link = document.createElement('a');
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '元ポスト';
  tile.appendChild(link);

  return tile;
}

function renderGrid(items) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (const item of items) grid.appendChild(renderTile(item));
}

function isUnfetched(item) {
  return item.media.length === 0 && !item.error;
}

async function fetchPending(items) {
  const pending = items.filter(isUnfetched);
  if (pending.length === 0) return;
  await Promise.all(pending.map((item) => fetchTweet(item)));
  await saveItems(items);
  renderGrid(items);
}

async function init() {
  const reloadBtn = document.getElementById('reload');
  const tileRange = document.getElementById('tile-size');

  tileRange.addEventListener('input', () => {
    document.documentElement.style.setProperty('--tile', `${tileRange.value}px`);
  });

  reloadBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'importBookmarks' });
  });

  let items = await loadItems();
  renderGrid(items);
  await fetchPending(items);

  if (hasChromeStorage) {
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      items = changes[STORAGE_KEY].newValue || [];
      renderGrid(items);
      await fetchPending(items);
    });
  }
}

init();
