/* vid2tune link downloader UI: asks the API for video info, then fetches the MP4/MP3 with progress. */
(() => {
  'use strict';

  const tool = document.querySelector('[data-link-tool]');
  if (!tool) return;

  const API = (tool.dataset.api || '').replace(/\/$/, '');
  const STRINGS = window.V2T_I18N || {};
  const t = (key, vars = {}) => (STRINGS[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  const form = tool.querySelector('.link-form');
  const input = tool.querySelector('#link-url');
  const submit = form.querySelector('button');
  const status = tool.querySelector('.link-status');
  const result = tool.querySelector('.link-result');
  const thumb = tool.querySelector('.link-thumb');
  const title = tool.querySelector('.link-title');
  const meta = tool.querySelector('.link-meta');
  const qSel = tool.querySelector('#link-q');
  const kbpsSel = tool.querySelector('#link-kbps');
  const videoBtn = tool.querySelector('#link-video');
  const audioBtn = tool.querySelector('#link-audio');
  const videoRow = tool.querySelector('.link-video-row');
  const progress = tool.querySelector('.link-progress');
  const bar = progress.querySelector('.progress-bar');

  let current = null; // { url, info }
  let busy = false;

  // Tell visitors straight away if the download service can't be reached.
  const offline = tool.querySelector('.link-offline');
  (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${API}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('down');
    } catch (_) {
      offline.hidden = false;
      tool.classList.add('is-offline');
    }
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const url = input.value.trim();
    if (!url) return;
    setBusy(true);
    result.hidden = true;
    setStatus(t('fetching'));
    try {
      const info = await api(`/api/info?url=${encodeURIComponent(url)}`).then((r) => r.json());
      current = { url, info };
      showInfo(info);
      setStatus('');
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      setBusy(false);
    }
  });

  // One-tap paste from the clipboard (where the browser allows it).
  const pasteBtn = tool.querySelector('.link-paste');
  if (navigator.clipboard && navigator.clipboard.readText) {
    pasteBtn.hidden = false;
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (!text) return;
        input.value = text;
        form.requestSubmit();
      } catch (_) {
        input.focus();
      }
    });
  }

  // Paste a link and go.
  input.addEventListener('paste', () => setTimeout(() => {
    if (/^https?:\/\//i.test(input.value.trim())) form.requestSubmit();
  }, 0));

  videoBtn.addEventListener('click', () => save('video'));
  audioBtn.addEventListener('click', () => save('audio'));

  function showInfo(info) {
    thumb.hidden = !info.thumbnail;
    if (info.thumbnail) thumb.src = info.thumbnail;
    title.textContent = info.title;
    meta.textContent = [info.site, info.uploader, info.duration ? fmtTime(info.duration) : ''].filter(Boolean).join(' · ');
    qSel.replaceChildren(...info.heights.map((h) => new Option(`${h}p`, h)));
    const preferred = info.heights.find((h) => h <= 720);
    if (preferred) qSel.value = preferred;
    videoRow.hidden = !info.hasVideo;
    progress.hidden = true;
    result.hidden = false;
  }

  async function save(type) {
    if (busy || !current) return;
    setBusy(true);
    const fmt = type === 'audio' ? 'MP3' : 'MP4';
    const params = new URLSearchParams({ url: current.url, type });
    if (type === 'audio') params.set('kbps', kbpsSel.value);
    else params.set('q', qSel.value);

    progress.hidden = false;
    bar.style.width = '0%';
    progress.classList.add('is-waiting');
    setStatus(t('preparing', { fmt }));
    try {
      const res = await api(`/api/download?${params}`);
      progress.classList.remove('is-waiting');
      const total = Number(res.headers.get('Content-Length')) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        if (total) {
          const pct = Math.round((got / total) * 100);
          bar.style.width = `${pct}%`;
          setStatus(t('downloadingPct', { pct }));
        }
      }
      const blob = new Blob(chunks, { type: type === 'audio' ? 'audio/mpeg' : 'video/mp4' });
      const name = fileName(res.headers.get('Content-Disposition')) || `${slug(current.info.title)}.${fmt.toLowerCase()}`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
      bar.style.width = '100%';
      setStatus(t('saved', { name }));
    } catch (err) {
      progress.hidden = true;
      setStatus(err.message, true);
    } finally {
      progress.classList.remove('is-waiting');
      setBusy(false);
    }
  }

  // Fetch from the API and turn failures into translated messages.
  async function api(path) {
    let res;
    try {
      res = await fetch(API + path);
    } catch (_) {
      throw new Error(t('offline'));
    }
    if (res.ok) return res;
    let code = 'failed';
    try {
      code = (await res.json()).error || code;
    } catch (_) { /* not JSON */ }
    throw new Error(STRINGS[`err_${code}`] || t('err_failed'));
  }

  function setBusy(on) {
    busy = on;
    tool.classList.toggle('is-busy', on);
    submit.disabled = videoBtn.disabled = audioBtn.disabled = on;
  }

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function fileName(header) {
    if (!header) return '';
    const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (star) return decodeURIComponent(star[1]);
    const plain = /filename="([^"]+)"/i.exec(header);
    return plain ? plain[1] : '';
  }

  function slug(s) {
    return String(s).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'video';
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    return `⁦${m}:${String(Math.floor(s % 60)).padStart(2, '0')}⁩`;
  }
})();
