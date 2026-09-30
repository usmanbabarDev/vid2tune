/* vid2tune converter UI. Everything runs locally: decode with Web Audio, encode in a worker. */
(() => {
  'use strict';

  const tool = document.querySelector('[data-tool]');
  if (!tool) return;

  const mode = tool.dataset.mode; // single | batch | trim
  const ringtone = tool.dataset.ringtone === '1';
  const MAX_BYTES = 2 * 1024 ** 3;
  const SAMPLE_RATE = 44100;
  // Resolve the worker next to this script so the site also works from a sub-folder.
  const APP_SRC = new URL(document.querySelector('script[src*="app.js"]').src);
  const WORKER_URL = new URL(`encoder-worker.js${APP_SRC.search}`, APP_SRC);
  const LOSSY = ['mp3', 'm4a', 'm4r'];

  // UI strings are injected per language by build.mjs.
  const STRINGS = window.V2T_I18N || {};
  const t = (key, vars = {}) => (STRINGS[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  const $ = (sel) => tool.querySelector(sel);
  const input = $('#file-input');
  const drop = $('.dropzone');
  const formatSel = $('#format');
  const bitrateSel = $('#bitrate');
  const bitrateField = $('.bitrate-field');
  const convertBtn = $('#convert');
  const list = $('.file-list');
  const dlAllBtn = $('#download-all');

  const trimPanel = $('.trim-panel');
  const canvas = $('.wave');
  const startIn = $('#trim-start');
  const endIn = $('#trim-end');
  const startOut = $('#trim-start-out');
  const endOut = $('#trim-end-out');
  const lenOut = $('#trim-len');
  const playBtn = $('#trim-play');
  const fadeIn = $('#fade-in');
  const fadeOut = $('#fade-out');

  let queue = [];
  let busy = false;
  let worker = null;
  let loadToken = 0;
  let trim = null; // { buffer, start, end, peaks }
  let player = null; // { ctx, src, startedAt, from, raf }

  formatSel.value = tool.dataset.format || 'mp3';
  if (ringtone && fadeIn) fadeIn.checked = fadeOut.checked = true;
  syncFormat();
  formatSel.addEventListener('change', syncFormat);
  addAacFormats();

  function syncFormat() {
    const fmt = formatSel.value.toUpperCase();
    bitrateField.hidden = !LOSSY.includes(formatSel.value);
    convertBtn.textContent = t(mode === 'trim' ? 'exportAs' : 'convertTo', { fmt });
  }

  // M4A (and M4R iPhone ringtones) need WebCodecs AAC encoding, which not every browser has.
  async function addAacFormats() {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return;
    try {
      const { supported } = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 192000,
      });
      if (!supported) return;
    } catch (_) {
      return;
    }
    const opts = ringtone ? [['m4r', 'M4R (iPhone)'], ['m4a', 'M4A']] : [['m4a', 'M4A (AAC)']];
    for (const [value, label] of opts) formatSel.add(new Option(label, value));
  }

  /* ---------- file intake ---------- */

  input.addEventListener('change', () => addFiles(input.files));
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => {
    e.preventDefault();
    if (!busy) drop.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
  }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  function addFiles(fileList) {
    if (busy) return;
    const files = [...fileList].filter((f) => f.size > 0);
    input.value = '';
    if (!files.length) return;
    if (mode !== 'batch') {
      clearQueue();
      files.length = 1;
    }
    for (const file of files) {
      const item = { file, url: null, blob: null, name: '', done: false, error: false, buffer: null };
      item.row = renderRow(item);
      if (file.size > MAX_BYTES) fail(item, t('tooBig'));
      queue.push(item);
    }
    refreshButtons();
    if (mode === 'trim' && !queue[0].error) loadTrim(queue[0]);
  }

  function clearQueue() {
    stopPreview();
    queue.forEach((i) => i.url && URL.revokeObjectURL(i.url));
    queue = [];
    list.replaceChildren();
    trim = null;
    if (trimPanel) trimPanel.hidden = true;
    drop.classList.remove('has-file');
  }

  function refreshButtons() {
    const pending = queue.some((i) => !i.done && !i.error);
    convertBtn.disabled = busy || (mode === 'trim' ? !trim : !pending);
    dlAllBtn.hidden = mode !== 'batch' || queue.filter((i) => i.blob).length < 2;
  }

  /* ---------- rows ---------- */

  function renderRow(item) {
    const li = document.createElement('li');
    li.className = 'file-row';
    li.innerHTML =
      '<div class="file-meta"><span class="file-name"></span><span class="file-size"></span></div>' +
      '<div class="progress" aria-hidden="true"><div class="progress-bar"></div></div>' +
      '<div class="file-foot"><span class="file-status"></span><span class="file-actions"></span></div>';
    li.querySelector('.file-status').textContent = t('ready');
    li.querySelector('.file-name').textContent = item.file.name;
    li.querySelector('.file-size').textContent = fmtBytes(item.file.size);
    list.appendChild(li);
    return li;
  }

  function setStatus(item, state, text, pct) {
    item.row.dataset.state = state;
    item.row.querySelector('.file-status').textContent = text;
    if (pct != null) item.row.querySelector('.progress-bar').style.width = `${pct}%`;
  }

  function fail(item, message) {
    item.error = true;
    setStatus(item, 'error', message, 0);
  }

  /* ---------- conversion ---------- */

  convertBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    stopPreview();
    tool.classList.add('is-busy');
    refreshButtons();
    for (const item of queue) {
      if (item.error || (item.done && mode !== 'trim')) continue;
      try {
        await convertItem(item);
      } catch (err) {
        console.error(err);
        fail(item, friendlyError(err));
      }
    }
    busy = false;
    tool.classList.remove('is-busy');
    refreshButtons();
  });

  async function convertItem(item) {
    setStatus(item, 'working', t('reading'), 3);
    const buffer = item.buffer || await decode(item.file);
    const rate = buffer.sampleRate;

    let from = 0;
    let to = buffer.length;
    if (mode === 'trim' && trim) {
      from = Math.floor(trim.start * rate);
      to = Math.floor(trim.end * rate);
    }
    const count = Math.min(2, buffer.numberOfChannels);
    const channels = [];
    for (let c = 0; c < count; c++) channels.push(buffer.getChannelData(c).slice(from, to));
    if (mode === 'trim') applyFades(channels, rate, fadeIn.checked, fadeOut.checked);

    const format = formatSel.value;
    setStatus(item, 'working', t('encoding', { pct: 0 }), 8);
    const blob = await encode(channels, rate, format, Number(bitrateSel.value), (p) => {
      setStatus(item, 'working', t('encoding', { pct: Math.round(p * 100) }), 8 + p * 92);
    });

    if (item.url) URL.revokeObjectURL(item.url);
    item.url = URL.createObjectURL(blob);
    item.blob = blob;
    item.done = true;

    const suffix = mode === 'trim' ? (ringtone ? '-ringtone' : '-trimmed') : '';
    const link = document.createElement('a');
    link.className = 'btn-download';
    link.href = item.url;
    item.name = `${baseName(item.file.name)}${suffix}.${format}`;
    link.download = item.name;
    link.textContent = t('download', { fmt: format.toUpperCase() });
    item.row.querySelector('.file-actions').replaceChildren(link);
    setStatus(item, 'done', t('done', { size: fmtBytes(blob.size), dur: fmtTime((to - from) / rate) }), 100);
  }

  async function decode(file) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: SAMPLE_RATE });
    try {
      const data = await file.arrayBuffer();
      return await ctx.decodeAudioData(data);
    } finally {
      ctx.close();
    }
  }

  function encode(channels, sampleRate, format, kbps, onProgress) {
    if (!worker) worker = new Worker(WORKER_URL);
    const w = worker;
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
      };
      const onMessage = (e) => {
        const d = e.data;
        if (d.id !== id) return;
        if (d.type === 'progress') onProgress(d.value);
        else if (d.type === 'done') { cleanup(); resolve(new Blob(d.parts, { type: d.mime })); }
        else if (d.type === 'error') { cleanup(); reject(new Error(d.message)); }
      };
      const onError = (e) => {
        cleanup();
        w.terminate();
        worker = null;
        reject(new Error(e.message || 'encoder stopped'));
      };
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      w.postMessage({ id, channels, sampleRate, format, kbps }, channels.map((c) => c.buffer));
    });
  }

  function applyFades(channels, rate, doIn, doOut) {
    const len = channels[0].length;
    const n = Math.min(Math.floor(rate * 1.5), Math.floor(len / 3));
    if (n <= 0) return;
    for (const ch of channels) {
      for (let i = 0; i < n; i++) {
        const g = i / n;
        if (doIn) ch[i] *= g;
        if (doOut) ch[len - 1 - i] *= g;
      }
    }
  }

  function friendlyError(err) {
    if (err && err.name === 'EncodingError') {
      return t('errDecode');
    }
    if (err && /memory|allocation|RangeError/i.test(`${err.name} ${err.message}`)) {
      return t('errMemory');
    }
    return t('errGeneric', { msg: (err && err.message) || '?' });
  }

  dlAllBtn.addEventListener('click', async () => {
    const ready = queue.filter((i) => i.blob);
    if (!ready.length) return;
    const label = dlAllBtn.textContent;
    dlAllBtn.disabled = true;
    dlAllBtn.textContent = t('zipping');
    try {
      const zip = await makeZip(ready.map((i) => ({ name: i.name, blob: i.blob })));
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vid2tune-audio.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      dlAllBtn.disabled = false;
      dlAllBtn.textContent = label;
    }
  });

  // Minimal "stored" (uncompressed) ZIP writer — audio is already compressed, so deflate would gain little.
  async function makeZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    const used = new Set();
    let offset = 0;
    for (const f of files) {
      let name = f.name;
      for (let n = 2; used.has(name); n++) name = f.name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
      used.add(name);
      const nameBytes = enc.encode(name);
      const data = new Uint8Array(await f.blob.arrayBuffer());
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, nameBytes.length, true);
      parts.push(local.buffer, nameBytes, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint32(42, offset, true);
      central.push(cd.buffer, nameBytes);
      offset += 30 + nameBytes.length + data.length;
    }
    const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }

  let crcTable;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  /* ---------- trimmer ---------- */

  async function loadTrim(item) {
    const token = ++loadToken;
    setStatus(item, 'working', t('loadingWave'), 10);
    let buffer;
    try {
      buffer = await decode(item.file);
    } catch (err) {
      if (token === loadToken) fail(item, friendlyError(err));
      return;
    }
    if (token !== loadToken) return;
    item.buffer = buffer;
    const d = buffer.duration;
    trim = { buffer, start: 0, end: ringtone ? Math.min(30, d) : d, peaks: null };
    for (const el of [startIn, endIn]) {
      el.max = d.toFixed(2);
      el.step = '0.01';
    }
    startIn.value = '0';
    endIn.value = trim.end.toFixed(2);
    trimPanel.hidden = false;
    drop.classList.add('has-file');
    updateTrim();
    setStatus(item, 'idle', t('trimHint', { dur: fmtTime(d) }), 0);
    refreshButtons();
  }

  if (trimPanel) {
    startIn.addEventListener('input', () => {
      trim.start = Math.min(Number(startIn.value), trim.end - 0.1);
      startIn.value = trim.start;
      stopPreview();
      updateTrim();
    });
    endIn.addEventListener('input', () => {
      trim.end = Math.max(Number(endIn.value), trim.start + 0.1);
      endIn.value = trim.end;
      stopPreview();
      updateTrim();
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!trim || busy) return;
      const rect = canvas.getBoundingClientRect();
      const t = ((e.clientX - rect.left) / rect.width) * trim.buffer.duration;
      if (Math.abs(t - trim.start) < Math.abs(t - trim.end)) {
        trim.start = Math.max(0, Math.min(t, trim.end - 0.1));
        startIn.value = trim.start;
      } else {
        trim.end = Math.min(trim.buffer.duration, Math.max(t, trim.start + 0.1));
        endIn.value = trim.end;
      }
      stopPreview();
      updateTrim();
    });
    playBtn.addEventListener('click', () => (player ? stopPreview() : startPreview()));
    new ResizeObserver(() => { if (trim) { trim.peaks = null; drawWave(); } }).observe(canvas);
  }

  function updateTrim() {
    startOut.textContent = fmtTime(trim.start, true);
    endOut.textContent = fmtTime(trim.end, true);
    const len = trim.end - trim.start;
    lenOut.textContent = t('selected', { len: fmtTime(len, true) });
    lenOut.classList.toggle('is-warn', ringtone && len > 40);
    drawWave();
  }

  function drawWave(playhead) {
    if (!trim) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      trim.peaks = null;
    }
    if (!trim.peaks) trim.peaks = computePeaks(trim.buffer, w);

    const css = getComputedStyle(tool);
    const dim = css.getPropertyValue('--wave-dim').trim();
    const on = css.getPropertyValue('--wave-on').trim();
    const sel = css.getPropertyValue('--wave-sel').trim();
    const head = css.getPropertyValue('--accent').trim();

    const g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    const d = trim.buffer.duration;
    const x0 = (trim.start / d) * w;
    const x1 = (trim.end / d) * w;
    g.fillStyle = sel;
    g.fillRect(x0, 0, x1 - x0, h);

    const mid = h / 2;
    for (let x = 0; x < w; x++) {
      const amp = Math.max(1, trim.peaks[x] * (h * 0.46));
      g.fillStyle = x >= x0 && x <= x1 ? on : dim;
      g.fillRect(x, mid - amp, 1, amp * 2);
    }
    g.fillStyle = head;
    g.fillRect(Math.round(x0) - dpr, 0, 2 * dpr, h);
    g.fillRect(Math.round(x1) - dpr, 0, 2 * dpr, h);
    if (playhead != null) {
      const px = (playhead / d) * w;
      g.globalAlpha = 0.7;
      g.fillRect(px, 0, dpr, h);
      g.globalAlpha = 1;
    }
  }

  function computePeaks(buffer, width) {
    const data = buffer.getChannelData(0);
    const per = Math.max(1, Math.floor(data.length / width));
    const peaks = new Float32Array(width);
    let max = 0;
    for (let x = 0; x < width; x++) {
      let peak = 0;
      const from = x * per;
      const to = Math.min(from + per, data.length);
      for (let i = from; i < to; i += 4) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
      peaks[x] = peak;
      if (peak > max) max = peak;
    }
    if (max > 0) for (let x = 0; x < width; x++) peaks[x] /= max;
    return peaks;
  }

  function startPreview() {
    if (!trim) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createBufferSource();
    src.buffer = trim.buffer;
    src.connect(ctx.destination);
    const dur = trim.end - trim.start;
    src.start(0, trim.start, dur);
    player = { ctx, src, startedAt: ctx.currentTime, from: trim.start, raf: 0 };
    src.onended = () => stopPreview();
    playBtn.textContent = t('stop');
    playBtn.setAttribute('aria-pressed', 'true');
    const tick = () => {
      if (!player) return;
      drawWave(player.from + (player.ctx.currentTime - player.startedAt));
      player.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopPreview() {
    if (!player) return;
    const p = player;
    player = null;
    cancelAnimationFrame(p.raf);
    p.src.onended = null;
    try { p.src.stop(); } catch (_) { /* already stopped */ }
    p.ctx.close();
    playBtn.textContent = t('play');
    playBtn.setAttribute('aria-pressed', 'false');
    drawWave();
  }

  /* ---------- helpers ---------- */

  function baseName(name) {
    const i = name.lastIndexOf('.');
    return (i > 0 ? name.slice(0, i) : name).replace(/[\\/:*?"<>|]+/g, '_');
  }

  // Sizes and times are wrapped in LTR isolates so "26 KB" doesn't flip on Urdu/Arabic pages.
  const ltr = (s) => `⁦${s}⁩`;

  function fmtBytes(n) {
    if (n < 1024) return ltr(`${n} B`);
    if (n < 1024 ** 2) return ltr(`${(n / 1024).toFixed(0)} KB`);
    if (n < 1024 ** 3) return ltr(`${(n / 1024 ** 2).toFixed(1)} MB`);
    return ltr(`${(n / 1024 ** 3).toFixed(2)} GB`);
  }

  function fmtTime(s, precise) {
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    const secStr = precise ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
    return ltr(`${m}:${secStr}`);
  }
})();
