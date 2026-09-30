# vid2tune

Free, private video → audio tools in English, Urdu, Hindi and Arabic. Everything runs in the browser: files are decoded with the Web Audio API and encoded in a Web Worker to MP3 (LAME, via `lamejs`), WAV, or AAC M4A/M4R (WebCodecs + `mp4-muxer`, shown only where the browser supports it). Nothing is uploaded, so hosting is static and costs almost nothing.

## Structure

```
build.mjs            templates + page setup → generates public/ (all languages), sitemap.xml, robots.txt
content/en.mjs       English copy for all 8 tools (source of truth)
content/ur|hi|ar.mjs translated UI + the 4 main tools (MP4→MP3, batch, trimmer, ringtone)
serve.mjs            local preview server (http://localhost:4173)
public/              the deployable site (generated HTML + static assets)
  assets/app.js      converter UI (single, batch + ZIP, trim/ringtone modes)
  assets/encoder-worker.js   MP3 / WAV / AAC encoding off the main thread
  assets/lame.min.js lamejs 1.2.1 (LGPL-3.0)
  assets/mp4-muxer.js mp4-muxer 5.2.2 (MIT)
  assets/style.css   light/dark, RTL-aware
  _headers           Cloudflare Pages headers
```

## Commands

```
node build.mjs     # regenerate pages after editing build.mjs
node serve.mjs     # preview locally
```

No `npm install` needed — zero dependencies.

## Adding a page or language

- **New tool page:** add it to `TOOLS` in `build.mjs` (slug + `mode`: `single` | `batch` | `trim`), then add its copy to `content/en.mjs` (`pages` and `tools`). Translate it by adding the same key to the other language files — pages missing from a language simply aren't generated there.
- **New language:** copy `content/ur.mjs` to e.g. `content/id.mjs`, translate it, set `meta.dir`, and add it to `LANGS` in `build.mjs`. Language switcher, hreflang tags and sitemap update automatically.
- Run `node build.mjs` after any change.

## Preview on GitHub Pages

Every push to `main` runs `.github/workflows/pages.yml`, which builds with `BASE_PATH=/<repo-name>` and publishes to `https://<user>.github.io/<repo-name>/`. That copy is for testing — its canonical tags point at vid2tune.com, so it won't compete with the real site in Google.

## Deploy (Cloudflare Pages, free)

1. Buy `vid2tune.com` (Cloudflare Registrar sells at cost).
2. Push this folder to a GitHub repo.
3. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
   - Build command: `node build.mjs`
   - Output directory: `public`
4. Add the custom domain `vid2tune.com`.
5. Submit `https://vid2tune.com/sitemap.xml` in Google Search Console.

## Monetisation checklist

- **AdSense:** apply once the site has ~15–20 pages and some traffic. When approved, paste the AdSense `<script>` where the `<!-- Ads: ... -->` comment is in `layout()` in `build.mjs`, and create `public/ads.txt` with the line Google gives you.
- **Consent:** AdSense requires a certified consent banner (CMP) for EU/UK visitors — enable Google's own in AdSense → Privacy & messaging.
- **Pro tier (needs your accounts):** e.g. no ads, bigger batches, video compression. Needs a Stripe account (plus a local gateway such as Safepay/PayFast for PKR, Razorpay for INR) and a small backend or Stripe Payment Links + license keys.

## Known limits

- Supported inputs depend on the browser's decoders: MP4/MOV (AAC), WebM, M4A, MP3, WAV, OGG/Opus, FLAC work in Chrome/Edge/Firefox. AVI/FLV and some MKV files usually don't.
- M4A/M4R output needs WebCodecs AAC encoding (Chrome/Edge on Windows, macOS, Android). Firefox and some Linux builds won't show the option. M4R files haven't been tested on a physical iPhone yet.
- `mp4-muxer` is deprecated upstream in favour of Mediabunny; it works fine, but migrate if you ever need new container features.
- Whole files are decoded into memory; very long videos (1h+) may fail on low-RAM phones.
- MP3 encoding runs at roughly 5–10× real-time on a laptop.
