// English content — the source of truth. Other languages translate a subset of these pages.
export const meta = { name: 'English', dir: 'ltr' };

export const ui = {
  nav: { mp4mp3: 'MP4 to MP3', batch: 'Batch', trim: 'Trimmer', ringtone: 'Ringtone', download: "Downloader" },
  badges: ['Free', 'No upload', 'No sign-up', 'No watermark'],
  dzSingle: 'Choose a video or drop it here',
  dzBatch: 'Choose videos or drop them here',
  dzTrim: 'Choose an audio or video file',
  dzSub: 'MP4, MOV, WebM, M4A, MP3, WAV and more · stays on your device',
  format: 'Format',
  quality: 'Quality',
  privacyNote: '🔒 Converted locally in your browser — nothing is uploaded.',
  start: 'Start',
  end: 'End',
  fadeIn: 'Fade in',
  fadeOut: 'Fade out',
  waveLabel: 'Waveform — tap to move the nearest edge of the selection',
  howItWorks: 'How it works',
  aboutTool: 'About this tool',
  faqTitle: 'Frequently asked questions',
  moreTools: 'More free tools',
  footerNote: 'Files never leave your device',
  about: 'About',
  privacy: 'Privacy',
  terms: 'Terms',
  contact: 'Contact',
  linkPlaceholder: "Paste a TikTok, Instagram, Facebook or X link",
  getVideo: "Get video",
  linkSites: "Works with TikTok · Instagram · Facebook · X · Pinterest · Reddit — not YouTube",
  linkLabel: "Video link",
  dlVideo: "Download MP4",
  dlAudio: "Download MP3",
  linkNote: "🔒 We fetch the public video and hand it straight to you — nothing is stored.",
  offlineNotice: "The link downloader is being set up and isn’t available yet.",
  offlineCta: "Convert a video file to MP3 instead →",
  home: 'vid2tune home',
};

// Strings used by assets/app.js at runtime.
export const runtime = {
  convertTo: 'Convert to {fmt}',
  exportAs: 'Export {fmt}',
  ready: 'Ready to convert',
  tooBig: 'This file is over 2 GB — too large to convert in a browser.',
  reading: 'Reading audio…',
  encoding: 'Encoding… {pct}%',
  download: 'Download {fmt}',
  done: 'Done · {size} · {dur}',
  loadingWave: 'Loading waveform…',
  trimHint: '{dur} long · drag the sliders to pick the part to keep',
  selected: '{len} selected',
  play: 'Play selection',
  stop: 'Stop',
  downloadAll: 'Download all (ZIP)',
  zipping: 'Preparing ZIP…',
  fetching: "Fetching video…",
  preparing: "Preparing your {fmt}… this can take up to a minute.",
  downloadingPct: "Downloading… {pct}%",
  saved: "Saved: {name}",
  offline: "The download service is offline right now. Please try again later.",
  err_bad_url: "That doesn’t look like a link. Copy the full address and try again.",
  err_youtube: "YouTube links aren’t supported.",
  err_unsupported: "This site isn’t supported yet. Try TikTok, Instagram, Facebook, X, Pinterest or Reddit.",
  err_private: "This post is private or needs a login, so it can’t be downloaded.",
  err_too_big: "This video is too large to download here.",
  err_no_video: "No downloadable video was found at that link.",
  err_gone: "That post seems to have been removed.",
  err_busy: "The server is busy — please try again in a minute.",
  err_rate: "Too many requests — please wait a few minutes.",
  err_timeout: "The site took too long to respond. Please try again.",
  err_no_ytdlp: "The download service is offline right now. Please try again later.",
  err_blocked: "This site blocks downloads of this post from our server’s region. Try another post.",
  err_failed: "Couldn’t fetch that video. Please try again later.",
  errDecode: 'Couldn’t read audio from this file. It may have no sound track, or use a codec this browser can’t open — try Chrome or Edge.',
  errMemory: 'This file is too long for your device’s memory. Try a shorter clip.',
  errGeneric: 'Conversion failed: {msg}',
};

export const tools = {
  download: ["Video downloader","Paste a link, get MP4 or MP3"],
  mp4mp3: ['MP4 to MP3', 'Convert a video to MP3'],
  batch: ['Batch MP4 to MP3', 'Convert many videos at once'],
  extract: ['Extract audio', 'Pull the sound out of any video'],
  wav: ['Video to WAV', 'Lossless audio for editing'],
  mov: ['MOV to MP3', 'iPhone and Mac videos'],
  webm: ['WebM to MP3', 'Screen and web recordings'],
  trim: ['Audio trimmer', 'Cut a clip from audio or video'],
  ringtone: ['Ringtone maker', '30-second ringtones with fades'],
};

const COMMON_FAQ = [
  ['Are my files uploaded to a server?', 'No. vid2tune converts everything inside your browser. Your video never leaves your device, which also means there is no upload wait and no file size queue.'],
  ['Is vid2tune free?', 'Yes. Every tool is free with no sign-up and no watermark.'],
  ['Which formats can I convert?', 'MP4, MOV, M4V, WebM, M4A, MP3, WAV, OGG, Opus and FLAC work in all modern browsers. Some less common codecs depend on your browser — Chrome and Edge support the most.'],
  ['Can I use this to download from YouTube or other sites?', 'No. vid2tune converts files that are already on your device. Please only convert content you own or have permission to use.'],
];

export const pages = {
  download: {
    "badges": ["Free","No sign-up","No watermark added","MP4 + MP3"],
    "title": "Video Downloader — Save TikTok, Instagram & Facebook Videos as MP4 or MP3 | vid2tune",
    "description": "Paste a TikTok, Instagram, Facebook, X or Pinterest link and download the video as MP4 or just the audio as MP3. Free, no sign-up, no watermark added.",
    "h1": "Video Downloader",
    "lead": "Paste a link from TikTok, Instagram, Facebook, X and more — get the video as MP4 or the sound as MP3.",
    "steps": [
      [
        "Copy the link",
        "Tap Share → Copy link in the app."
      ],
      [
        "Paste it here",
        "We find the video and show a preview."
      ],
      [
        "Pick MP4 or MP3",
        "Choose the quality and save it to your device."
      ]
    ],
    "body": "<p>Save your own Reels, TikToks and posts to repost, edit or back up — or grab just the audio as an MP3. Only public posts can be downloaded.</p>\n<p><strong>Please respect creators:</strong> download only your own content or content you have permission to use.</p>",
    "faq": [
      [
        "Which sites are supported?",
        "TikTok, Instagram, Facebook, X (Twitter), Pinterest, Reddit, Dailymotion, Threads and SoundCloud. YouTube is not supported."
      ],
      [
        "Why did my link fail?",
        "Private posts, stories and anything that needs a login can’t be downloaded. Check that the post is public and the link is complete."
      ],
      [
        "Do you keep a copy of the video?",
        "No. The video is fetched, sent to you and deleted from our server straight away."
      ],
      [
        "Is it free?",
        "Yes — no sign-up and no watermark added."
      ]
    ]
  },
  mp4mp3: {
    title: 'MP4 to MP3 Converter — Free, Private, No Upload | vid2tune',
    description: 'Convert MP4 to MP3 online for free. Runs in your browser — no upload, no sign-up, no watermark. Choose 128–320 kbps quality.',
    h1: 'MP4 to MP3 Converter',
    lead: 'Turn any video into an MP3 in seconds. Your file is converted right in your browser — it is never uploaded.',
    steps: [
      ['Choose your video', 'Drop an MP4 (or MOV, WebM, M4A) onto the box, or tap to pick one.'],
      ['Pick the quality', '192 kbps suits most music; choose 320 kbps for the best sound.'],
      ['Download your MP3', 'Hit Convert and save the MP3 straight to your device.'],
    ],
    body: `<p><strong>vid2tune</strong> is a free MP4 to MP3 converter that works entirely offline once the page has loaded. Because nothing is uploaded, conversions start instantly and your private recordings stay private.</p>
<p>Use it to save the audio from lectures, voice notes, interviews, podcasts you recorded, or clips for your own edits and WhatsApp statuses.</p>`,
    faq: [
      ['What MP3 quality should I choose?', '128 kbps is fine for speech and keeps files small. 192 kbps is a good default for music. 320 kbps is the highest MP3 quality.'],
      ...COMMON_FAQ,
    ],
  },
  batch: {
    title: 'Batch MP4 to MP3 Converter — Convert Many Files at Once | vid2tune',
    description: 'Bulk convert multiple MP4 videos to MP3 in one go and download them as a ZIP. Free, no upload — everything runs in your browser.',
    h1: 'Batch MP4 to MP3 Converter',
    lead: 'Select a whole folder of videos and convert them all to MP3 in one click.',
    steps: [
      ['Add all your videos', 'Select or drop as many files as you like.'],
      ['Set the format', 'MP3 at your chosen quality, or WAV for lossless.'],
      ['Convert & get a ZIP', 'Files convert one by one; save them individually or all together as one ZIP.'],
    ],
    body: `<p>Bulk conversion is handy for course videos, lecture series, recorded meetings and sample packs. Files are processed one after another on your own device, so there is no upload limit or waiting in a server queue.</p>`,
    faq: [
      ['How many files can I convert at once?', 'There is no fixed limit. Very large batches depend on your device’s memory — if one file fails, convert it separately.'],
      ['How do I download everything at once?', 'Click “Download all (ZIP)” to save every converted file in a single ZIP archive.'],
      ...COMMON_FAQ,
    ],
  },
  extract: {
    title: 'Extract Audio from Video Online — MP3 or WAV | vid2tune',
    description: 'Extract the audio track from any video and save it as MP3, WAV or M4A. Free and private — your video is never uploaded.',
    h1: 'Extract Audio from Video',
    lead: 'Pull the soundtrack out of any video and save it as MP3 or lossless WAV.',
    steps: [
      ['Open your video', 'MP4, MOV and WebM all work.'],
      ['Pick MP3 or WAV', 'MP3 for small files, WAV for editing without quality loss.'],
      ['Save the audio', 'Download the extracted track instantly.'],
    ],
    body: `<p>Extracting audio is useful for transcribing interviews, reusing your own voice-overs, or editing sound separately in apps like Audacity, CapCut or Premiere.</p>`,
    faq: COMMON_FAQ,
  },
  wav: {
    title: 'Video to WAV Converter — Lossless Audio | vid2tune',
    description: 'Convert MP4, MOV or WebM video to uncompressed WAV audio. Free, in-browser, no upload.',
    h1: 'Video to WAV Converter',
    lead: 'Get uncompressed 16-bit WAV audio from your videos — ideal for editing and transcription.',
    steps: [
      ['Choose a video', 'Drop in an MP4, MOV or WebM file.'],
      ['Keep WAV selected', 'WAV is lossless, so nothing more is lost when you edit.'],
      ['Download', 'Your WAV file is ready as soon as conversion ends.'],
    ],
    body: `<p>WAV files are larger than MP3 but add no further compression, which makes them the best choice for audio editing, DAWs and speech-to-text tools.</p>`,
    faq: [
      ['Is WAV better than MP3?', 'WAV adds no extra compression, so it keeps the audio exactly as decoded. MP3 is much smaller and fine for listening.'],
      ...COMMON_FAQ,
    ],
  },
  mov: {
    title: 'MOV to MP3 Converter — iPhone Videos to MP3 | vid2tune',
    description: 'Convert MOV videos from iPhone, iPad or Mac to MP3. Free, private, and works on mobile — no upload needed.',
    h1: 'MOV to MP3 Converter',
    lead: 'Turn iPhone and Mac MOV videos into MP3 audio, right on your phone or computer.',
    steps: [
      ['Pick a MOV file', 'Choose a video from Photos, Files or your computer.'],
      ['Choose quality', '192 kbps is a good default.'],
      ['Download the MP3', 'Save it to Files or your Downloads folder.'],
    ],
    body: `<p>MOV is Apple’s video format, used by iPhone, iPad and QuickTime. vid2tune reads the AAC audio inside and re-encodes it to MP3 so it plays everywhere.</p>`,
    faq: COMMON_FAQ,
  },
  webm: {
    title: 'WebM to MP3 Converter — Free & Private | vid2tune',
    description: 'Convert WebM recordings to MP3 in your browser. No upload, no sign-up, no watermark.',
    h1: 'WebM to MP3 Converter',
    lead: 'Convert WebM screen recordings, voice notes and web videos to MP3.',
    steps: [
      ['Choose a WebM file', 'Drop it on the box or tap to browse.'],
      ['Choose quality', 'Pick a bitrate from 128 to 320 kbps.'],
      ['Download the MP3', 'Ready in seconds.'],
    ],
    body: `<p>WebM is common for screen recordings, browser recorders and meeting tools. Its Opus or Vorbis audio is decoded and saved as a universally playable MP3.</p>`,
    faq: COMMON_FAQ,
  },
  trim: {
    title: 'Audio Trimmer — Cut MP3 or Video Audio Online | vid2tune',
    description: 'Trim audio or the sound from a video online. Pick start and end on a waveform, add fades, export MP3 or WAV. Free, no upload.',
    h1: 'Audio Trimmer',
    lead: 'Cut the exact part you need from any audio or video file, with optional fade in and fade out.',
    steps: [
      ['Open a file', 'Audio or video — MP3, M4A, WAV, MP4 and more.'],
      ['Select the part', 'Drag the sliders or tap the waveform, then play to check.'],
      ['Export', 'Save the clip as MP3 or WAV.'],
    ],
    body: `<p>Tap the waveform to move the nearest edge of the selection, and use the sliders for fine control. Add a short fade in or fade out for a clean start and finish.</p>`,
    faq: COMMON_FAQ,
  },
  ringtone: {
    title: 'Ringtone Maker — Make a Ringtone from Any Song or Video | vid2tune',
    description: 'Create a ringtone from any song or video. Pick the best 30 seconds, add fades and download an MP3 or iPhone M4R. Free and private.',
    h1: 'Ringtone Maker',
    lead: 'Pick your favourite 30 seconds of any song or video and save it as a ringtone.',
    steps: [
      ['Open a song or video', 'Any file on your phone or computer.'],
      ['Pick up to 30 seconds', 'Fade in and fade out are switched on for you.'],
      ['Save and set it', 'Download MP3 for Android, or M4R for iPhone.'],
    ],
    body: `<p><strong>Android:</strong> save the MP3, then go to Settings → Sound → Phone ringtone and choose the file (or move it into your <em>Ringtones</em> folder).</p>
<p><strong>iPhone:</strong> choose <em>M4R (iPhone)</em> as the format if your browser offers it, then add the file to your iPhone with Finder (Mac) or iTunes (Windows). Using only your phone? Save the MP3, import it into GarageBand and use Share → Ringtone.</p>`,
    faq: [
      ['How long should a ringtone be?', 'Up to 30 seconds works on every phone; iPhone requires 40 seconds or less.'],
      ['Why don’t I see the M4R option?', 'M4R needs AAC encoding, which only some browsers provide. Try Chrome or Edge on a computer, or use the GarageBand method with an MP3.'],
      ...COMMON_FAQ,
    ],
  },
};
