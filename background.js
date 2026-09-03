import { canonicalizeStatusUrl, extractTweetId, buildSyndicationUrl, extractTweetMedia } from './lib.js';

const CACHE_KEY = 'mornXReferenceCache';

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://x.com/i/bookmarks#mornxref' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'fetchTweet') {
    fetchTweet(message.url)
      .then(sendResponse)
      .catch(() => sendResponse({ error: true }));
    return true;
  }
});

async function fetchTweet(rawUrl) {
  const url = canonicalizeStatusUrl(rawUrl) || rawUrl;
  const id = extractTweetId(url);
  const store = await chrome.storage.local.get(CACHE_KEY);
  const cache = store[CACHE_KEY] || {};
  if (cache[url]) return cache[url];

  const result = await fetchFromSyndication(id);
  cache[url] = result;
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
  return result;
}

async function fetchFromSyndication(id) {
  try {
    const res = await fetch(buildSyndicationUrl(id));
    if (!res.ok) throw new Error('fetch failed');
    const media = extractTweetMedia(await res.json());
    return media ? { ...media, error: null } : { error: true };
  } catch {
    return { error: true };
  }
}
