import { canonicalizeStatusUrl, extractTweetId, buildSyndicationUrl, extractTweetMedia } from './lib.js';

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://x.com/i/history#mornxref' });
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
  const url = canonicalizeStatusUrl(rawUrl);
  if (!url) return { error: true };
  const id = extractTweetId(url);
  const key = `mornXReferenceTweet:${id}`;
  const store = await chrome.storage.local.get(key);
  if (store[key] && !store[key].error) return store[key];

  const result = await fetchFromSyndication(id);
  // 投稿ごとに保存し、並列取得によるキャッシュ全体の上書きを避ける。
  if (!result.error) await chrome.storage.local.set({ [key]: result });
  return result;
}

async function fetchFromSyndication(id) {
  try {
    const res = await fetch(buildSyndicationUrl(id), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('fetch failed');
    const media = extractTweetMedia(await res.json());
    return media ? { ...media, error: null } : { error: true };
  } catch {
    return { error: true };
  }
}
