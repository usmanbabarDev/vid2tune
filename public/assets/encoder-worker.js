/* vid2tune encoder worker: turns raw PCM channels into MP3 (LAME), WAV or AAC (M4A/M4R), off the main thread. */
importScripts('lame.min.js');

const MP3_BLOCK = 1152 * 32;
const WAV_BLOCK = 44100 * 4;

const MIME = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', m4r: 'audio/mp4' };

self.onmessage = async (e) => {
  const { id, channels, sampleRate, format, kbps } = e.data;
  const progress = makeProgress(id);
  try {
    let parts;
    if (format === 'wav') parts = encodeWav(channels, sampleRate, progress);
    else if (format === 'm4a' || format === 'm4r') parts = await encodeAac(channels, sampleRate, kbps, progress);
    else parts = encodeMp3(channels, sampleRate, kbps, progress);
    self.postMessage({ id, type: 'done', parts, mime: MIME[format] }, parts.map((p) => p.buffer));
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
};

function makeProgress(id) {
  let last = -1;
  return (value) => {
    const pct = Math.floor(value * 100);
    if (pct !== last) {
      last = pct;
      self.postMessage({ id, type: 'progress', value });
    }
  };
}

function toInt16(f32, from, to) {
  const out = new Int16Array(to - from);
  for (let i = 0; i < out.length; i++) {
    let s = f32[from + i];
    s = s < -1 ? -1 : s > 1 ? 1 : s;
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeMp3(channels, sampleRate, kbps, progress) {
  const encoder = new lamejs.Mp3Encoder(channels.length, sampleRate, kbps);
  const total = channels[0].length;
  const parts = [];
  for (let i = 0; i < total; i += MP3_BLOCK) {
    const end = Math.min(i + MP3_BLOCK, total);
    const left = toInt16(channels[0], i, end);
    const chunk = channels.length > 1
      ? encoder.encodeBuffer(left, toInt16(channels[1], i, end))
      : encoder.encodeBuffer(left);
    if (chunk.length) parts.push(chunk);
    progress(end / total);
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(tail);
  return parts;
}

function encodeWav(channels, sampleRate, progress) {
  const numCh = channels.length;
  const total = channels[0].length;
  const dataBytes = total * numCh * 2;

  const header = new DataView(new ArrayBuffer(44));
  const str = (off, s) => { for (let i = 0; i < s.length; i++) header.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  header.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, numCh, true);
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * numCh * 2, true);
  header.setUint16(32, numCh * 2, true);
  header.setUint16(34, 16, true);
  str(36, 'data');
  header.setUint32(40, dataBytes, true);

  const parts = [new Uint8Array(header.buffer)];
  for (let i = 0; i < total; i += WAV_BLOCK) {
    const end = Math.min(i + WAV_BLOCK, total);
    const block = new Int16Array((end - i) * numCh);
    for (let j = i, k = 0; j < end; j++) {
      for (let c = 0; c < numCh; c++) {
        let s = channels[c][j];
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        block[k++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
    }
    parts.push(block);
    progress(end / total);
  }
  return parts;
}

// AAC via WebCodecs, muxed into an MP4 audio container (.m4a / .m4r).
async function encodeAac(channels, sampleRate, kbps, progress) {
  if (typeof Mp4Muxer === 'undefined') importScripts('mp4-muxer.js');
  const numberOfChannels = channels.length;
  const total = channels[0].length;
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    audio: { codec: 'aac', numberOfChannels, sampleRate },
    fastStart: 'in-memory',
  });
  let failure = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => { failure = err; },
  });
  encoder.configure({ codec: 'mp4a.40.2', numberOfChannels, sampleRate, bitrate: Math.min(kbps, 256) * 1000 });

  const frames = 1024 * 16;
  for (let i = 0; i < total; i += frames) {
    if (failure) throw failure;
    const n = Math.min(frames, total - i);
    const planar = new Float32Array(n * numberOfChannels);
    for (let c = 0; c < numberOfChannels; c++) planar.set(channels[c].subarray(i, i + n), c * n);
    const data = new AudioData({
      format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels,
      timestamp: Math.round((i / sampleRate) * 1e6), data: planar,
    });
    encoder.encode(data);
    data.close();
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    progress((i + n) / total);
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  muxer.finalize();
  return [new Uint8Array(muxer.target.buffer)];
}
