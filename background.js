import { canonicalizeStatusUrl, extractTweetId } from './lib.js';

const STORAGE_KEY = 'mornXReferenceItems';
const INDEX_URL = chrome.runtime.getURL('index.html');

async function focusOrOpenIndexTab() {
  const [existing] = await chrome.tabs.query({ url: INDEX_URL });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    return existing;
  }
  return chrome.tabs.create({ url: 'index.html' });
}

chrome.action.onClicked.addListener(() => {
  focusOrOpenIndexTab();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'importBookmarks') {
    chrome.tabs.create({ url: 'https://x.com/i/bookmarks#mornxref', active: true });
    return;
  }
  if (message?.type === 'bookmarksCollected') {
    handleBookmarksCollected(message.urls || [], sender).catch(() => {});
  }
});

async function handleBookmarksCollected(rawUrls, sender) {
  const urls = [...new Set(rawUrls.map(canonicalizeStatusUrl).filter(Boolean))];
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const existingItems = result[STORAGE_KEY] || [];
  const existingByUrl = new Map(existingItems.map((item) => [item.url, item]));

  const items = urls.map(
    (url) =>
      existingByUrl.get(url) || {
        url,
        tweetId: extractTweetId(url),
        author: null,
        text: null,
        media: [],
        error: null,
      }
  );
  await chrome.storage.local.set({ [STORAGE_KEY]: items });

  if (sender.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
  }
  await focusOrOpenIndexTab();
}
