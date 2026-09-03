// Pure functions shared by app.js/background.js (import) and test.mjs (node). No DOM/fetch here.

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

// Normalizes a tweet permalink to https://x.com/<name>/status/<id> — drops
// trailing segments (/photo/1 etc.), query strings, and maps twitter.com to x.com.
export function canonicalizeStatusUrl(url) {
  const m = String(url).match(/^https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/([^/?#]+)\/status\/(\d+)/);
  if (!m) return null;
  return `https://x.com/${m[1]}/status/${m[2]}`;
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

// Turns a syndication API tweet-result JSON body into { author, text, media } or null on tombstone.
// media entries: { kind: 'image', src } or { kind: 'video', src, poster }.
export function extractTweetMedia(tweetResult) {
  if (!tweetResult || tweetResult.__typename === 'TweetTombstone') return null;
  const author = tweetResult.user ? tweetResult.user.screen_name : null;
  const text = tweetResult.text || '';
  const details = tweetResult.mediaDetails || [];
  const media = [];
  for (const item of details) {
    if (item.type === 'photo') {
      media.push({ kind: 'image', src: item.media_url_https });
    } else if (item.type === 'video' || item.type === 'animated_gif') {
      const variant = pickVariant(item.video_info && item.video_info.variants);
      if (!variant) continue;
      media.push({ kind: 'video', src: variant.url, poster: item.media_url_https || null });
    }
  }
  return { author, text, media };
}
