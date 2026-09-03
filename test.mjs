import assert from 'node:assert/strict';
import { extractTweetId, buildToken, addUrls, pickVariant, extractTweetMedia } from './lib.js';

// extractTweetId
assert.equal(extractTweetId('https://x.com/foo/status/1234567890123456789'), '1234567890123456789');
assert.equal(extractTweetId('https://twitter.com/foo/status/42?s=20'), '42');
assert.equal(extractTweetId('https://mobile.twitter.com/foo/status/99/photo/1'), '99');
assert.equal(extractTweetId('https://example.com/video.mp4'), null);

// buildToken matches react-tweet's formula
assert.equal(buildToken('1234567890123456789'), ((Number('1234567890123456789') / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ''));

// addUrls: dedupe across calls and within one paste
{
  const { items: step1 } = addUrls([], 'https://x.com/a/status/1\nhttps://x.com/a/status/1\n');
  assert.equal(step1.length, 1);
  const { items: step2, added } = addUrls(step1, 'https://x.com/a/status/1\nhttps://x.com/b/status/2');
  assert.equal(step2.length, 2);
  assert.equal(added.length, 1);
  assert.equal(added[0].url, 'https://x.com/b/status/2');
}

// direct video url (no /status/) keeps the raw url and null tweetId
{
  const { items } = addUrls([], 'https://video.example.com/clip.mp4');
  assert.equal(items[0].tweetId, null);
}

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

// extractTweetMedia: normal tweet with one video
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
      { type: 'photo' },
    ],
  });
  assert.equal(media.author, 'someone');
  assert.equal(media.videos.length, 1);
  assert.equal(media.videos[0].src, 'https://video.twimg.com/mid.mp4');
  assert.equal(media.videos[0].poster, 'https://pbs.twimg.com/poster.jpg');
}

console.log('ok');
