import { addUrls, buildSyndicationUrl, extractTweetMedia } from './lib.js';

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
    item.videos = [{ src: item.url, poster: null }];
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
    if (!media) {
      item.error = '取得不可';
      return;
    }
    item.author = media.author;
    item.text = media.text;
    item.videos = media.videos;
    if (item.videos.length === 0) item.error = '取得不可';
  } catch {
    item.error = '取得不可';
  }
}

function renderTile(item) {
  const tile = document.createElement('div');
  tile.className = 'tile';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', async () => {
    const items = (await loadItems()).filter((i) => i.url !== item.url);
    await saveItems(items);
    tile.remove();
  });
  tile.appendChild(removeBtn);

  if (item.error) {
    const err = document.createElement('div');
    err.className = 'error';
    err.textContent = item.error;
    tile.appendChild(err);
  } else if (item.videos && item.videos.length > 0) {
    for (const v of item.videos) {
      const video = document.createElement('video');
      video.src = v.src;
      if (v.poster) video.poster = v.poster;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      tile.appendChild(video);
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
  link.textContent = '元ツイート';
  tile.appendChild(link);

  return tile;
}

function renderGrid(items) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (const item of items) grid.appendChild(renderTile(item));
}

async function init() {
  const form = document.getElementById('add-form');
  const textarea = document.getElementById('urls');
  const tileRange = document.getElementById('tile-size');

  tileRange.addEventListener('input', () => {
    document.documentElement.style.setProperty('--tile', `${tileRange.value}px`);
  });

  let items = await loadItems();
  renderGrid(items);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { items: nextItems, added } = addUrls(items, textarea.value);
    items = nextItems;
    await saveItems(items);
    renderGrid(items);
    textarea.value = '';
    await Promise.all(added.map((item) => fetchTweet(item)));
    await saveItems(items);
    renderGrid(items);
  });
}

init();
