import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_ROOT = join(ROOT, 'assets/audio/voice');
const SAMPLE_RATE = 32000;
const CACHE_FILE = join(OUT_ROOT, '.cache.json');

function readTable(file) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const table = {};
  for (const match of source.matchAll(/^\s+'([^']+)':\s*'((?:[^'\\]|\\.)*)',$/gm)) {
    table[match[1]] = match[2].replace(/\\'/g, "'");
  }
  return table;
}

const TABLES = { en: readTable('src/i18n/en.ts'), tr: readTable('src/i18n/tr.ts') };

function isVoiceKey(key) {
  return /^(warden|exile|log)\./.test(key) || /^term\.b\d+\.n\d$/.test(key);
}

const RECORDING_SPEAKERS = ['hale', 'voss', 'lund', 'dray', 'sato', 'brandt', 'pell', 'moreau', 'iyer', 'kessler'];

function speakerFor(key) {
  if (key.startsWith('warden.')) return 'warden';
  if (key.startsWith('exile.')) return 'exile';
  if (key.startsWith('log.')) return 'log';
  const floor = /^term\.b(\d+)\./.exec(key);
  if (floor) return RECORDING_SPEAKERS[Number(floor[1]) - 1] ?? 'warden';
  return 'warden';
}

const hiss = (level) => `[a][n]amix=inputs=2:duration=first:weights=1 ${level}`;

function recording(enVoice, enPitch, trVoice, trRate, trPitch, noise, vibrato) {
  return {
    en: { engine: 'flite', voice: enVoice, pitch: enPitch },
    tr: { engine: 'espeak', voice: trVoice, rate: trRate, pitch: trPitch, pitchShift: 1 },
    chain: `vibrato=f=${vibrato}:d=0.12,highpass=f=210,lowpass=f=3300,acrusher=bits=8:mix=0.45:mode=lin:aa=0,volume=1.5`,
    noise,
  };
}

const SPEAKERS = {
  warden: {
    en: { engine: 'flite', voice: 'awb', pitch: 0.84 },
    tr: { engine: 'espeak', voice: 'tr+m1', rate: 128, pitch: 24, pitchShift: 0.9 },
    chain: 'highpass=f=260,lowpass=f=3300,acrusher=bits=9:mix=0.45:mode=lin:aa=0,aecho=0.8:0.55:18|52:0.28|0.14,volume=1.6,alimiter=limit=0.9',
    squelch: true,
  },
  exile: {
    en: { engine: 'flite', voice: 'slt', pitch: 0.94 },
    tr: { engine: 'espeak', voice: 'tr+whisper', rate: 118, pitch: 58, pitchShift: 1 },
    chain: 'highpass=f=150,lowpass=f=4300,aecho=0.5:0.5:70|140:0.25|0.12,volume=1.9,alimiter=limit=0.85',
  },
  hale: recording('kal', 1.05, 'tr+f1', 145, 55, 0.14, 4),
  voss: recording('rms', 0.9, 'tr+m6', 135, 30, 0.18, 3.6),
  lund: recording('slt', 0.92, 'tr+f2', 125, 45, 0.2, 4.2),
  dray: recording('awb', 0.95, 'tr+m4', 132, 28, 0.16, 3.5),
  sato: recording('slt', 1.05, 'tr+f3', 140, 52, 0.16, 4.4),
  brandt: recording('rms', 0.85, 'tr+m7', 128, 26, 0.22, 3.4),
  pell: recording('awb', 1.05, 'tr+f4', 120, 48, 0.14, 4.1),
  moreau: recording('kal', 0.9, 'tr+m5', 135, 32, 0.2, 3.8),
  iyer: recording('slt', 1.0, 'tr+f5', 135, 58, 0.18, 4.6),
  kessler: recording('rms', 1.0, 'tr+f1', 132, 42, 0.12, 4),
  log: {
    en: { engine: 'flite', voice: 'kal', pitch: 1 },
    tr: { engine: 'espeak', voice: 'tr+m5', rate: 150, pitch: 40, pitchShift: 1 },
    chain: 'highpass=f=250,lowpass=f=3200,acrusher=bits=9:mix=0.35:mode=lin:aa=0,volume=0.8,alimiter=limit=0.9',
  },
};

function run(command, args) {
  execFileSync(command, args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

function renderRaw(lang, spec, text, workDir, rawPath) {
  if (spec.engine === 'flite') {
    const textFile = join(workDir, 'line.txt');
    writeFileSync(textFile, text);
    run('ffmpeg', ['-y', '-loglevel', 'error', '-filter_complex', `flite=textfile=${textFile}:voice=${spec.voice}[o]`, '-map', '[o]', '-ar', '16000', '-ac', '1', rawPath]);
    return 16000;
  }
  run('python3', [join(ROOT, 'tools/espeak_render.py'), rawPath, text, spec.voice, String(spec.rate), String(spec.pitch)]);
  return 22050;
}

function encode(lang, speaker, spec, rawPath, rawRate, outPath) {
  const shift = spec.engine === 'flite' ? spec.pitch : spec.pitchShift;
  const base = [`asetrate=${Math.round(rawRate * shift)}`, `aresample=${SAMPLE_RATE}`, `atempo=${(1 / shift).toFixed(4)}`].join(',');
  const parts = [`[0:a]${base},${speaker.chain}[a]`];
  let map = '[a]';
  if (speaker.noise) {
    parts.push(`anoisesrc=c=pink:a=0.05:r=${SAMPLE_RATE},highpass=f=700,lowpass=f=4500[n]`);
    parts.push(`${hiss(speaker.noise)}[m]`);
    map = '[m]';
  }
  if (speaker.squelch) {
    parts.push(`anoisesrc=d=0.14:c=pink:a=0.22:r=${SAMPLE_RATE},highpass=f=900,lowpass=f=3600[sq]`);
    parts.push(`[sq]${map}concat=n=2:v=0:a=1[o]`);
    map = '[o]';
  }
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawPath, '-filter_complex', parts.join(';'), '-map', map, '-c:a', 'libvorbis', '-q:a', '4', '-ar', String(SAMPLE_RATE), '-ac', '1', outPath]);
}

function hasTool(command, args) {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const work = join(tmpdir(), 'station-zero-voice');
mkdirSync(work, { recursive: true });
mkdirSync(OUT_ROOT, { recursive: true });
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const espeakOk = hasTool('python3', ['-c', 'import ctypes; ctypes.CDLL("libespeak-ng.so.1")']);

let rendered = 0;
let skipped = 0;
let total = 0;
for (const lang of ['en', 'tr']) {
  const dir = join(OUT_ROOT, lang);
  mkdirSync(dir, { recursive: true });
  if (lang === 'tr' && !espeakOk) {
    console.warn('libespeak-ng not found: skipping Turkish voice (subtitles only).');
    continue;
  }
  for (const key of Object.keys(TABLES.en).filter(isVoiceKey)) {
    const text = TABLES[lang][key];
    if (!text) continue;
    const speakerName = speakerFor(key);
    const speaker = SPEAKERS[speakerName];
    const spec = speaker[lang];
    const out = join(dir, `${key}.ogg`);
    const hash = createHash('sha1').update(JSON.stringify({ text, speakerName, spec, chain: speaker.chain, noise: speaker.noise, sq: speaker.squelch })).digest('hex');
    if (existsSync(out) && cache[`${lang}/${key}`] === hash) {
      skipped += 1;
      total += statSync(out).size;
      continue;
    }
    const raw = join(work, `${lang}-${key}.wav`);
    const rate = renderRaw(lang, spec, text, work, raw);
    encode(lang, speaker, spec, raw, rate, out);
    cache[`${lang}/${key}`] = hash;
    rendered += 1;
    total += statSync(out).size;
  }
}

writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
rmSync(work, { recursive: true, force: true });
console.log(`voice: ${rendered} rendered, ${skipped} cached, ${(total / 1024).toFixed(0)} KB total`);
