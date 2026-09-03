import assert from 'node:assert/strict';
import { extractTweetId, buildToken, canonicalizeStatusUrl, pickVariant, extractTweetMedia } from './lib.js';

// extractTweetId
assert.equal(extractTweetId('https://x.com/foo/status/1234567890123456789'), '1234567890123456789');
assert.equal(extractTweetId('https://twitter.com/foo/status/42?s=20'), '42');
assert.equal(extractTweetId('https://mobile.twitter.com/foo/status/99/photo/1'), '99');
assert.equal(extractTweetId('https://example.com/video.mp4'), null);

// buildToken matches react-tweet's formula
assert.equal(buildToken('1234567890123456789'), ((Number('1234567890123456789') / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ''));

// canonicalizeStatusUrl: strips /photo/1, query strings, and maps twitter.com to x.com
assert.equal(
  canonicalizeStatusUrl('https://x.com/foo/status/1234567890123456789/photo/1'),
  'https://x.com/foo/status/1234567890123456789'
);
assert.equal(canonicalizeStatusUrl('https://twitter.com/foo/status/42?s=20'), 'https://x.com/foo/status/42');
assert.equal(canonicalizeStatusUrl('https://x.com/foo/status/99'), 'https://x.com/foo/status/99');
assert.equal(canonicalizeStatusUrl('https://example.com/video.mp4'), null);

// pickVariant: prefers the highest bitrate <= 3,000,000
{
  const v = pickVariant([
    { content_type: 'video/mp4', bitrate: 5000000, url: 'hi' },
    { content_type: 'video/mp4', bitrate: 2000000, url: 'mid' },
    { content_type: 'video/mp4', bitrate: 800000, url: 'low' },
    { content_type: 'application/x-mpegURL', bitrate: 0, url: 'm3u8' },
  ]);
  assert.equal(v.url, 'mid');
}

// pickVariant: falls back to the lowest bitrate when everything exceeds the cap
{
  const v = pickVariant([
    { content_type: 'video/mp4', bitrate: 9000000, url: 'a' },
    { content_type: 'video/mp4', bitrate: 5000000, url: 'b' },
  ]);
  assert.equal(v.url, 'b');
}

assert.equal(pickVariant([]), null);
assert.equal(pickVariant(undefined), null);

// extractTweetMedia: tombstone -> null
assert.equal(extractTweetMedia({ __typename: 'TweetTombstone' }), null);

// extractTweetMedia: video + photo in one tweet
{
  const media = extractTweetMedia({
    user: { screen_name: 'someone' },
    text: 'hello world',
    mediaDetails: [
      {
        type: 'video',
        media_url_https: 'https://pbs.twimg.com/poster.jpg',
        video_info: {
          variants: [
            { content_type: 'video/mp4', bitrate: 2000000, url: 'https://video.twimg.com/mid.mp4' },
            { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/x.m3u8' },
          ],
        },
      },
      { type: 'photo', media_url_https: 'https://pbs.twimg.com/photo.jpg' },
    ],
  });
  assert.equal(media.author, 'someone');
  assert.equal(media.media.length, 2);
  assert.equal(media.media[0].kind, 'video');
  assert.equal(media.media[0].src, 'https://video.twimg.com/mid.mp4');
  assert.equal(media.media[0].poster, 'https://pbs.twimg.com/poster.jpg');
  assert.equal(media.media[1].kind, 'image');
  assert.equal(media.media[1].src, 'https://pbs.twimg.com/photo.jpg');
}

console.log('ok');
