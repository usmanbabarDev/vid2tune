// Generates the static site in public/ from content/*.mjs. Run: node build.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as en from './content/en.mjs';
import * as ur from './content/ur.mjs';
import * as hi from './content/hi.mjs';
import * as ar from './content/ar.mjs';

const SITE_URL = 'https://vid2tune.com';
const SITE_NAME = 'vid2tune';
const YEAR = 2026;
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'public');
// Set BASE_PATH (e.g. "/vid2tune") when the site is served from a sub-folder, like GitHub Pages.
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

// English lives at the root; other languages under /<code>/.
const LANGS = { en, ur, hi, ar };
const ACCEPT = 'video/*,audio/*,.mp4,.m4v,.mov,.webm,.m4a,.mp3,.wav,.ogg,.oga,.opus,.flac,.aac';

// Page key → URL slug and converter setup (shared by every language).
const TOOLS = {
  home: { slug: '', mode: 'single', format: 'mp3' },
  batch: { slug: 'batch-mp4-to-mp3/', mode: 'batch', format: 'mp3' },
  extract: { slug: 'extract-audio-from-video/', mode: 'single', format: 'mp3' },
  wav: { slug: 'video-to-wav/', mode: 'single', format: 'wav' },
  mov: { slug: 'mov-to-mp3/', mode: 'single', format: 'mp3' },
  webm: { slug: 'webm-to-mp3/', mode: 'single', format: 'mp3' },
  trim: { slug: 'audio-trimmer/', mode: 'trim', format: 'mp3' },
  ringtone: { slug: 'ringtone-maker/', mode: 'trim', format: 'mp3', ringtone: true },
};
const NAV_KEYS = ['home', 'batch', 'trim', 'ringtone'];

const INFO_PAGES = [
  {
    path: '/about/',
    title: 'About vid2tune',
    description: 'vid2tune is a free, private toolkit for turning video into audio — built to run entirely in your browser.',
    html: `<h1>About vid2tune</h1>
<p>Most online converters upload your files to a server and cover the page in pop-ups and fake download buttons. vid2tune was built to be the opposite: clean, fast and private.</p>
<p>Every tool runs inside your browser using the Web Audio API, the LAME MP3 encoder and your browser’s built-in AAC encoder. Your files are never uploaded or stored anywhere.</p>
<p>vid2tune is available in English, <a href="/ur/">اردو</a>, <a href="/hi/">हिन्दी</a> and <a href="/ar/">العربية</a>.</p>
<p>Questions or ideas? Email <a href="mailto:hello@vid2tune.com">hello@vid2tune.com</a>.</p>`,
  },
  {
    path: '/privacy/',
    title: 'Privacy Policy | vid2tune',
    description: 'How vid2tune handles your data. Files are processed on your device and never uploaded.',
    html: `<h1>Privacy Policy</h1>
<p><em>Last updated: 30 September ${YEAR}</em></p>
<h2>Your files</h2>
<p>Files you open in vid2tune are processed entirely on your device. They are not uploaded, stored or seen by us.</p>
<h2>Analytics and advertising</h2>
<p>We may use privacy-respecting analytics and, in future, advertising partners such as Google AdSense to keep the service free. These partners may use cookies to measure visits and show ads. Where required by law (for example in the EU/UK), we will ask for your consent first. You can learn how Google uses data at <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">policies.google.com/technologies/partner-sites</a>.</p>
<h2>Contact</h2>
<p>Email <a href="mailto:hello@vid2tune.com">hello@vid2tune.com</a> with any privacy question.</p>`,
  },
  {
    path: '/terms/',
    title: 'Terms of Use | vid2tune',
    description: 'Terms of use for vid2tune.',
    html: `<h1>Terms of Use</h1>
<p><em>Last updated: 30 September ${YEAR}</em></p>
<p>vid2tune is provided free of charge and “as is”, without warranties of any kind.</p>
<h2>Acceptable use</h2>
<p>Only convert files that you own or have the right to use. You are responsible for respecting copyright and the terms of any platform your content came from. vid2tune does not download content from YouTube or other websites.</p>
<h2>Liability</h2>
<p>To the fullest extent allowed by law, vid2tune is not liable for any loss arising from use of the service.</p>`,
  },
];

/* ---------- helpers ---------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const prefix = (lang) => (lang === 'en' ? '/' : `/${lang}/`);
const pathFor = (lang, key) => prefix(lang) + TOOLS[key].slug;
const has = (lang, key) => Boolean(LANGS[lang].pages[key]);
// JSON inside <script> must not be able to close the tag.
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const ICON_UPLOAD = `<svg class="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>`;
const LOGO = `<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#5b3df5"/><path d="M11 9.5v13l6.5-6.5z" fill="#fff"/><path d="M20 11v9.2a2.3 2.3 0 1 1-1.4-2.1V11z" fill="#fff" opacity=".85"/></svg>`;

/* ---------- templates ---------- */

// key: tool page key (for nav, hreflang and language links), or null for English-only pages.
function layout({ lang = 'en', key = null, path, title, description, main, jsonLd = [], script = '' }) {
  const L = LANGS[lang];
  const url = SITE_URL + path;
  const nav = NAV_KEYS.map((k) => {
    const href = pathFor(lang, k);
    return `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${esc(L.ui.nav[k])}</a>`;
  }).join('');

  const langLinks = Object.keys(LANGS).map((code) => {
    const href = key && has(code, key) ? pathFor(code, key) : prefix(code);
    const current = code === lang ? ' aria-current="true"' : '';
    return `<a href="${href}" hreflang="${code}" lang="${code}"${current}>${esc(LANGS[code].meta.name)}</a>`;
  }).join('');

  const alternates = key
    ? Object.keys(LANGS).filter((code) => has(code, key))
      .map((code) => `<link rel="alternate" hreflang="${code}" href="${SITE_URL}${pathFor(code, key)}">`)
      .concat(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${pathFor('en', key)}">`).join('\n')
    : '';

  const ld = jsonLd.map((o) => `<script type="application/ld+json">${safeJson(o)}</script>`).join('\n');
  const u = L.ui;
  return `<!doctype html>
<html lang="${lang}" dir="${L.meta.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${alternates}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#5b3df5">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
${ld}
<!-- Ads: once AdSense approves the site, paste its <script> tag here and fill /ads.txt. -->
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="${prefix(lang)}" aria-label="${esc(u.home)}">${LOGO}<span class="wordmark" dir="ltr">vid<span>2</span>tune</span></a>
    <nav class="nav" aria-label="Tools">${nav}</nav>
    <nav class="langs" aria-label="Language">${langLinks}</nav>
  </div>
</header>
<main>
${main}
</main>
<footer class="site-footer">
  <div class="wrap">
    <span>© ${YEAR} vid2tune · ${esc(u.footerNote)}</span>
    <nav aria-label="Site"><a href="/about/">${esc(u.about)}</a><a href="/privacy/">${esc(u.privacy)}</a><a href="/terms/">${esc(u.terms)}</a><a href="mailto:hello@vid2tune.com">${esc(u.contact)}</a></nav>
  </div>
</footer>
${script}
</body>
</html>
`;
}

function toolWidget(lang, { mode, format, ringtone }) {
  const { ui: u, runtime: r } = LANGS[lang];
  const multiple = mode === 'batch' ? ' multiple' : '';
  const dzTitle = mode === 'batch' ? u.dzBatch : mode === 'trim' ? u.dzTrim : u.dzSingle;
  const trim = mode !== 'trim' ? '' : `
  <div class="trim-panel" hidden>
    <canvas class="wave" aria-label="${esc(u.waveLabel)}"></canvas>
    <div class="trim-grid">
      <div><label for="trim-start">${esc(u.start)} <output id="trim-start-out" dir="ltr">0:00.0</output></label><input id="trim-start" type="range" min="0" max="1" step="0.01" value="0"></div>
      <div><label for="trim-end">${esc(u.end)} <output id="trim-end-out" dir="ltr">0:00.0</output></label><input id="trim-end" type="range" min="0" max="1" step="0.01" value="1"></div>
    </div>
    <div class="trim-bar">
      <button type="button" id="trim-play" class="btn-secondary" aria-pressed="false">${esc(r.play)}</button>
      <label><input type="checkbox" id="fade-in"> ${esc(u.fadeIn)}</label>
      <label><input type="checkbox" id="fade-out"> ${esc(u.fadeOut)}</label>
      <span id="trim-len" aria-live="polite"></span>
    </div>
  </div>`;
  return `<section class="tool" data-tool data-mode="${mode}" data-format="${format}" data-ringtone="${ringtone ? 1 : 0}" aria-label="Converter">
  <label class="dropzone" for="file-input">
    <input id="file-input" class="visually-hidden" type="file" accept="${ACCEPT}"${multiple}>
    ${ICON_UPLOAD}
    <span class="dz-title">${esc(dzTitle)}</span>
    <span class="dz-sub">${esc(u.dzSub)}</span>
  </label>${trim}
  <div class="options">
    <label class="field">${esc(u.format)}
      <select id="format"><option value="mp3">MP3</option><option value="wav">WAV</option></select>
    </label>
    <label class="field bitrate-field">${esc(u.quality)}
      <select id="bitrate" dir="ltr"><option value="128">128 kbps</option><option value="192" selected>192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select>
    </label>
    <button type="button" id="convert" class="btn-primary" disabled>${esc(r.convertTo.replace('{fmt}', format.toUpperCase()))}</button>
  </div>
  <ul class="file-list" aria-live="polite"></ul>
  <button type="button" id="download-all" class="btn-secondary" hidden>${esc(r.downloadAll)}</button>
</section>
<p class="privacy-note">${esc(u.privacyNote)}</p>`;
}

function toolPage(lang, key) {
  const L = LANGS[lang];
  const p = L.pages[key];
  const u = L.ui;
  const path = pathFor(lang, key);
  const steps = p.steps.map(([t, d]) => `<li><strong>${esc(t)}</strong>${esc(d)}</li>`).join('');
  const faq = p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const related = Object.keys(L.tools).filter((k) => k !== key && has(lang, k))
    .map((k) => `<a href="${pathFor(lang, k)}">${esc(L.tools[k][0])}<span>${esc(L.tools[k][1])}</span></a>`).join('');
  const badges = u.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('');
  const main = `<div class="wrap">
  <section class="hero">
    <h1>${esc(p.h1)}</h1>
    <p>${esc(p.lead)}</p>
    <div class="badges">${badges}</div>
  </section>
  ${toolWidget(lang, TOOLS[key])}
  <article class="content">
    <h2>${esc(u.howItWorks)}</h2>
    <ol class="steps">${steps}</ol>
    <h2>${esc(u.aboutTool)}</h2>
    ${p.body}
    <h2>${esc(u.faqTitle)}</h2>
    <div class="faq">${faq}</div>
    <h2>${esc(u.moreTools)}</h2>
    <nav class="tools-grid" aria-label="${esc(u.moreTools)}">${related}</nav>
  </article>
</div>`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `${p.h1} — ${SITE_NAME}`,
      url: SITE_URL + path,
      inLanguage: lang,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any (web browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
  const script = `<script>window.V2T_I18N = ${safeJson(L.runtime)};</script>\n<script src="/assets/app.js" defer></script>`;
  return layout({ lang, key, path, title: p.title, description: p.description, main, jsonLd, script });
}

/* ---------- write ---------- */

// Root-relative links get the base path; absolute URLs (canonical, hreflang) keep pointing at SITE_URL.
const withBase = (html) => (BASE ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`) : html);

function write(path, html) {
  const file = join(OUT, path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, withBase(html));
}

const sitemap = [];
for (const lang of Object.keys(LANGS)) {
  for (const key of Object.keys(TOOLS)) {
    if (!has(lang, key)) continue;
    const path = pathFor(lang, key);
    write(path, toolPage(lang, key));
    sitemap.push(path);
  }
}
for (const p of INFO_PAGES) {
  write(p.path, layout({ ...p, main: `<div class="wrap"><article class="content prose">${p.html}</article></div>` }));
  sitemap.push(p.path);
}

writeFileSync(join(OUT, '404.html'), withBase(layout({
  path: '/404/',
  title: 'Page not found | vid2tune',
  description: 'This page does not exist.',
  main: `<div class="wrap"><section class="hero"><h1>Page not found</h1><p>That page doesn’t exist. <a href="/">Go to the MP4 to MP3 converter</a>.</p></section></div>`,
})));

const urls = sitemap.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n');
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built ${sitemap.length + 1} pages into ${OUT}`);
