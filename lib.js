// Pure functions shared by app.js (browser) and test.mjs (node). No DOM/fetch here.

export function extractTweetId(url) {
  const m = String(url).match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

export function buildToken(tweetId) {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export function buildSyndicationUrl(tweetId) {
  const token = buildToken(tweetId);
  return `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=${token}`;
}

export function normalizeUrl(url) {
  return String(url).trim();
}

// Adds new urls to existing items, skipping duplicates and blanks. Returns { items, added }.
export function addUrls(existingItems, rawText) {
  const existingUrls = new Set(existingItems.map((item) => item.url));
  const items = existingItems.slice();
  const added = [];
  for (const line of String(rawText).split('\n')) {
    const url = normalizeUrl(line);
    if (!url || existingUrls.has(url)) continue;
    existingUrls.add(url);
    const entry = { url, tweetId: extractTweetId(url), author: null, text: null, videos: [], error: null };
    items.push(entry);
    added.push(entry);
  }
  return { items, added };
}

// variants: video_info.variants[] from the syndication API. Picks the mp4 with
// bitrate <= 3,000,000 that has the highest bitrate, falling back to the lowest
// bitrate mp4 when none qualify.
export function pickVariant(variants) {
  const mp4s = (variants || []).filter((v) => v.content_type === 'video/mp4');
  if (mp4s.length === 0) return null;
  const withinLimit = mp4s.filter((v) => (v.bitrate || 0) <= 3000000);
  if (withinLimit.length > 0) {
    return withinLimit.reduce((best, v) => ((v.bitrate || 0) > (best.bitrate || 0) ? v : best));
  }
  return mp4s.reduce((best, v) => ((v.bitrate || 0) < (best.bitrate || 0) ? v : best));
}

// Turns a syndication API tweet-result JSON body into { author, text, videos } or null on tombstone.
export function extractTweetMedia(tweetResult) {
  if (!tweetResult || tweetResult.__typename === 'TweetTombstone') return null;
  const author = tweetResult.user ? tweetResult.user.screen_name : null;
  const text = tweetResult.text || '';
  const details = tweetResult.mediaDetails || [];
  const videos = [];
  for (const media of details) {
    if (media.type !== 'video' && media.type !== 'animated_gif') continue;
    const variant = pickVariant(media.video_info && media.video_info.variants);
    if (!variant) continue;
    videos.push({ src: variant.url, poster: media.media_url_https || null });
  }
  return { author, text, videos };
}
