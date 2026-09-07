# 告知画像

`MornDesktopTube/design/ogp.psd` をコピーして作成した、MornXReference 用のデザインです。元の背景・配色・文字組みを引き継ぎ、ロゴ、説明文、ギャラリーの図に差し替えています。右側は機能を説明するイメージで、実際の画面のスクリーンショットではありません。

- `ogp.psd`: 編集用マスター（1920×1080）。文字・図形は個別レイヤー。元デザインの未使用要素は非表示で保持。
- `thumbnail.png`: サムネイル（1920×1080）。READMEや16:9の告知用。
- `ogp.png`: OGP画像（1200×630）。マスターを縮小し、上下の余白を均等に切り抜き。

Photoshopで `ogp.psd` を編集して保存した後、「ファイル > スクリプト > 参照」から `export.jsx` を実行すると、両方のPNGを書き出せます。フォントはヒラギノ角ゴシックとHelvetica Neueを使用しています。書き出しはこのディレクトリ内のPSDのみを参照します。

アイコンの編集元は `../icons/icon.svg` です。ブックマークに4枚のタイルを配置し、告知画像と同じ黄緑・オリーブを使用しています。Playwrightが利用できる環境で `node icons/export.mjs` を実行すると、拡張機能用の16・32・48・128pxのPNGを更新できます。アイコンを変更した場合は、PSDの「MornXReference アイコン」レイヤーも差し替えてから告知画像を書き出してください。

## Chromeウェブストア用

- `store-promo.psd`: 小さいプロモーション画像の編集用PSD（440×280）。
- `../docs/store/promo-small.png`: 必須のサムネイル（440×280、透明部分なし）。
- `../docs/store/screenshot-gallery.png`: ギャラリー一覧（1280×800）。
- `../docs/store/screenshot-images.png`: 画像だけに絞り込んだ一覧（1280×800）。

Photoshopで `export-store.jsx` を実行すると、`ogp.psd` とアイコンからストア用PSD・サムネイル・`samples/` の画像を書き出します。`store-promo.psd` を直接編集した場合はそのPSDからPNGを書き出してください（スクリプトの再実行はPSDを作り直します）。

スクリーンショットは実際の `content.js` のUIを、架空のサンプル投稿で表示したものです。Xのページや実在のユーザーの投稿は使用していません。Playwrightが利用できる環境で `node design/export-screenshots.mjs` を実行して再作成できます。サンプル動画は `ffmpeg -loop 1 -i design/samples/sample-0.png -t 2 -c:v libvpx-vp9 -pix_fmt yuv420p design/samples/sample-video.webm` で生成しています。

サイズ要件: [Chromeウェブストア公式の掲載情報ガイド](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)（2026-09-07確認）。ストア画像は拡張機能本体のZIPに含めず、掲載情報の各欄へアップロードします。

`node design/check-store.mjs` で3枚の画像サイズと、透過なしの8bit RGB PNG形式を検証できます。
