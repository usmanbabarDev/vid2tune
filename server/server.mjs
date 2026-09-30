// vid2tune link downloader API. Wraps yt-dlp + ffmpeg; no npm dependencies.
//
//   GET /api/health                              → { ok, ytdlp }
//   GET /api/info?url=…                          → title, thumbnail, duration, available heights
//   GET /api/download?url=…&type=video&q=720     → streams an MP4
//   GET /api/download?url=…&type=audio&kbps=192  → streams an MP3
//
// Env: PORT (8787), ALLOWED_ORIGINS (comma list, default "*"), YTDLP (path to yt-dlp),
//      FFMPEG_DIR (folder holding ffmpeg, if not on PATH), MAX_FILESIZE (default "500M"),
//      MAX_JOBS (concurrent downloads, default 3).
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT) || 8787;
const YTDLP = process.env.YTDLP || 'yt-dlp';
const FFMPEG_DIR = process.env.FFMPEG_DIR || '';
const MAX_FILESIZE = process.env.MAX_FILESIZE || '500M';
const MAX_JOBS = Number(process.env.MAX_JOBS) || 3;
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
const INFO_TIMEOUT = 30_000;
const DOWNLOAD_TIMEOUT = 10 * 60_000;

// Only these sites are accepted. YouTube is deliberately excluded.
const ALLOWED_HOSTS = [
  'tiktok.com', 'instagram.com', 'facebook.com', 'fb.watch', 'x.com', 'twitter.com',
  'pinterest.com', 'pin.it', 'reddit.com', 'redd.it', 'vimeo.com', 'dailymotion.com', 'dai.ly',
  'threads.net', 'threads.com', 'soundcloud.com',
];
const BLOCKED_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'];
const HEIGHTS = [2160, 1440, 1080, 720, 480, 360, 240];

const hostMatches = (host, list) => list.some((d) => host === d || host.endsWith(`.${d}`));

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function checkUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    throw new HttpError(400, 'bad_url', 'That doesn’t look like a link.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new HttpError(400, 'bad_url', 'Only web links are supported.');
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (hostMatches(host, BLOCKED_HOSTS)) throw new HttpError(422, 'youtube', 'YouTube links aren’t supported.');
  if (!hostMatches(host, ALLOWED_HOSTS)) throw new HttpError(422, 'unsupported', 'This site isn’t supported yet.');
  return u.toString();
}

// Arguments shared by every call. "--" stops a crafted URL being read as an option;
// "-generic" stops yt-dlp fetching arbitrary pages the allowlist didn't approve.
function baseArgs() {
  const args = ['--ignore-config', '--no-playlist', '--no-warnings', '--ies', 'default,-generic,-youtube.*',
    '--socket-timeout', '20', '--max-filesize', MAX_FILESIZE];
  if (FFMPEG_DIR) args.push('--ffmpeg-location', FFMPEG_DIR);
  return args;
}

function run(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new HttpError(504, 'timeout', 'The site took too long to respond.'));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e.code === 'ENOENT'
        ? new HttpError(503, 'no_ytdlp', 'Download service isn’t set up (yt-dlp not found).')
        : e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(explain(err));
    });
  });
}

// Turn yt-dlp's stderr into a message a visitor can act on.
function explain(stderr) {
  const s = stderr.toLowerCase();
  if (/ip address is blocked|geo.?restrict|not available in your (country|region)/.test(s)) {
    return new HttpError(451, 'blocked', 'This site is blocking downloads of this post from our server’s region.');
  }
  if (/login|log in|sign in|cookies|private|rate-limit|not available/.test(s)) {
    return new HttpError(422, 'private', 'This post is private or needs a login, so it can’t be downloaded.');
  }
  if (/max-filesize|larger than max/.test(s)) return new HttpError(413, 'too_big', `This video is larger than ${MAX_FILESIZE}.`);
  if (/unsupported url|no video|no suitable|there is no video/.test(s)) {
    return new HttpError(422, 'no_video', 'No downloadable video was found at that link.');
  }
  if (/404|not found|removed|deleted/.test(s)) return new HttpError(404, 'gone', 'That post seems to have been removed.');
  console.error('[yt-dlp]', stderr.trim().split('\n').slice(-3).join(' | '));
  return new HttpError(502, 'failed', 'Couldn’t fetch that video. Please try again later.');
}

async function info(url) {
  const json = JSON.parse(await run([...baseArgs(), '-J', '--', url], INFO_TIMEOUT));
  const entry = json._type === 'playlist' && json.entries ? json.entries.find(Boolean) || json : json;
  const formats = entry.formats || [];
  const hasVideo = formats.some((f) => f.vcodec && f.vcodec !== 'none') || Boolean(entry.height);
  const maxH = Math.max(0, ...formats.filter((f) => f.vcodec !== 'none' && f.height).map((f) => f.height), entry.height || 0);
  return {
    title: entry.title || entry.description?.slice(0, 80) || 'video',
    uploader: entry.uploader || entry.channel || '',
    thumbnail: entry.thumbnail || '',
    duration: entry.duration || null,
    site: entry.extractor_key || '',
    hasVideo,
    heights: hasVideo ? HEIGHTS.filter((h) => h <= (maxH || 1080)).slice(0, 5) : [],
  };
}

let activeJobs = 0;

async function download(url, type, q, kbps, res) {
  if (activeJobs >= MAX_JOBS) throw new HttpError(429, 'busy', 'The server is busy — please try again in a minute.');
  activeJobs++;
  const dir = await mkdtemp(join(tmpdir(), 'v2t-'));
  try {
    const args = [...baseArgs(), '-o', join(dir, '%(title).80B [%(id)s].%(ext)s'), '--restrict-filenames'];
    if (type === 'audio') {
      args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', `${kbps}K`);
    } else {
      const h = q;
      args.push('-f', `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/bv*[height<=${h}]+ba/b[height<=${h}]/b`,
        '--merge-output-format', 'mp4', '--remux-video', 'mp4');
    }
    args.push('--', url);
    await run(args, DOWNLOAD_TIMEOUT);

    const files = (await readdir(dir)).filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
    if (!files.length) throw new HttpError(502, 'failed', 'The download didn’t produce a file.');
    const file = join(dir, files[0]);
    const { size } = await stat(file);
    const ext = type === 'audio' ? 'mp3' : 'mp4';
    const name = files[0].replace(/\.[^.]+$/, `.${ext}`);
    res.writeHead(200, {
      'Content-Type': type === 'audio' ? 'audio/mpeg' : 'video/mp4',
      'Content-Length': size,
      'Content-Disposition': `attachment; filename="${name.replace(/[^\w.\-\[\] ]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    });
    await new Promise((resolve, reject) => {
      const stream = createReadStream(file);
      stream.on('error', reject);
      res.on('close', resolve);
      stream.pipe(res);
    });
  } finally {
    activeJobs--;
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Simple per-IP limiter: 30 requests / 10 minutes.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) if (times.every((t) => now - t > 10 * 60_000)) hits.delete(ip);
}, 60_000).unref();

function cors(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}

function sendJson(res, status, body) {
  if (res.headersSent) return res.end();
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  cors(req, res);
  const { pathname, searchParams } = new URL(req.url, 'http://x');
  const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
  try {
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    if (req.method !== 'GET') throw new HttpError(405, 'method', 'Method not allowed.');

    if (pathname === '/api/health') {
      const version = await run(['--version'], 10_000).then((v) => v.trim()).catch(() => null);
      return sendJson(res, version ? 200 : 503, { ok: Boolean(version), ytdlp: version });
    }
    if (pathname === '/api/info' || pathname === '/api/download') {
      if (rateLimited(ip)) throw new HttpError(429, 'rate', 'Too many requests — please wait a few minutes.');
      const url = checkUrl(searchParams.get('url'));
      if (pathname === '/api/info') return sendJson(res, 200, await info(url));

      const type = searchParams.get('type') === 'audio' ? 'audio' : 'video';
      const q = HEIGHTS.includes(Number(searchParams.get('q'))) ? Number(searchParams.get('q')) : 720;
      const kbps = [128, 192, 256, 320].includes(Number(searchParams.get('kbps'))) ? Number(searchParams.get('kbps')) : 192;
      return await download(url, type, q, kbps, res);
    }
    throw new HttpError(404, 'not_found', 'Not found.');
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    const e = err instanceof HttpError ? err : new HttpError(500, 'error', 'Something went wrong.');
    sendJson(res, e.status, { error: e.code, message: e.message });
  }
}).listen(PORT, () => console.log(`vid2tune API on http://localhost:${PORT}`));
