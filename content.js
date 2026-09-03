// Runs only when the user was sent here via #mornxref (background.js opens
// https://x.com/i/bookmarks#mornxref). A normal bookmarks visit does nothing.
if (location.hash === '#mornxref') {
  run();
}

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

function makeBadge() {
  const badge = document.createElement('div');
  badge.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#000;color:#fff;' +
    'font:14px system-ui,sans-serif;padding:8px 12px;border-radius:8px;opacity:0.9;';
  document.body.appendChild(badge);
  return badge;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const collected = new Set();
  const badge = makeBadge();
  let stableCount = 0;
  let lastHeight = -1;

  for (let i = 0; i < 300; i++) {
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      if (!hasMedia(article)) continue;
      const href = findPermalink(article);
      if (href) collected.add(href);
    }
    badge.textContent = `MornXReference: ${collected.size} 件収集中…`;

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

  badge.textContent = `MornXReference: ${collected.size} 件を送信`;
  chrome.runtime.sendMessage({ type: 'bookmarksCollected', urls: [...collected] });
}
