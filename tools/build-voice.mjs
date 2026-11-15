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

const PIPER_DIR = process.env.PIPER_DIR ?? join(ROOT, 'tools/.piper');
const PIPER_PYTHON = join(PIPER_DIR, 'venv/bin/python');
const PIPER_VOICE = 'tr_TR-fahrettin-medium';
const PIPER_VOICE_URL = 'https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium/resolve/main';
const PIPER_MODEL = join(PIPER_DIR, `${PIPER_VOICE}.onnx`);
const TR_PRONUNCIATION = [
  [/mahkûm/giu, '[[mahkˈum]]'],
  [/hâlâ/giu, '[[haːlˈaː]]'],
];

function spokenText(lang, text) {
  if (lang !== 'tr') return text;
  return TR_PRONUNCIATION.reduce((line, [word, phonemes]) => line.replace(word, phonemes), text);
}

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
  return /^(warden|exile)\./.test(key);
}

function speakerFor(key) {
  if (key.startsWith('warden.')) return 'warden';
  if (key.startsWith('exile.')) return 'exile';
  return 'warden';
}

const hiss = (level) => `[a][n]amix=inputs=2:duration=first:weights=1 ${level}`;

const SPEAKERS = {
  warden: {
    en: { engine: 'flite', voice: 'awb', pitch: 0.84 },
    tr: {
      engine: 'piper',
      lengthScale: 1.18,
      noiseScale: 0.1,
      noiseW: 0.1,
      sentenceSilence: 0.35,
      pitchShift: 0.82,
      chain: 'highpass=f=380,lowpass=f=2700,aecho=0.9:0.9:7|13:0.55|0.4,tremolo=f=62:d=0.75,acrusher=bits=8:mix=0.6:mode=lin:aa=0,apad=pad_dur=1.3,aecho=0.8:0.7:140|290|480:0.38|0.2|0.12,volume=1.2,alimiter=limit=0.9',
    },
    chain: 'highpass=f=260,lowpass=f=3300,acrusher=bits=9:mix=0.45:mode=lin:aa=0,aecho=0.8:0.55:18|52:0.28|0.14,volume=1.6,alimiter=limit=0.9',
    squelch: true,
  },
  exile: {
    en: { engine: 'flite', voice: 'slt', pitch: 0.94 },
    tr: {
      engine: 'piper',
      lengthScale: 1.05,
      noiseScale: 0.667,
      noiseW: 0.8,
      sentenceSilence: 0,
      pitchShift: 1,
      chain: 'highpass=f=150,lowpass=f=4300,aecho=0.5:0.5:70|140:0.25|0.12,volume=1.3,alimiter=limit=0.85',
    },
    chain: 'highpass=f=150,lowpass=f=4300,aecho=0.5:0.5:70|140:0.25|0.12,volume=1.9,alimiter=limit=0.85',
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
  const textFile = join(workDir, 'line.txt');
  writeFileSync(textFile, text);
  run(PIPER_PYTHON, [
    '-m', 'piper', '-m', PIPER_MODEL, '-i', textFile, '-f', rawPath,
    '--length-scale', String(spec.lengthScale),
    '--noise-scale', String(spec.noiseScale),
    '--noise-w-scale', String(spec.noiseW),
    '--sentence-silence', String(spec.sentenceSilence),
  ]);
  return JSON.parse(readFileSync(`${PIPER_MODEL}.json`, 'utf8')).audio.sample_rate;
}

function encode(lang, speaker, spec, rawPath, rawRate, outPath) {
  const shift = spec.engine === 'flite' ? spec.pitch : spec.pitchShift;
  const base = [`asetrate=${Math.round(rawRate * shift)}`, `aresample=${SAMPLE_RATE}`, `atempo=${(1 / shift).toFixed(4)}`].join(',');
  const parts = [`[0:a]${base},${spec.chain ?? speaker.chain}[a]`];
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
const piperOk = existsSync(PIPER_MODEL) && hasTool(PIPER_PYTHON, ['-c', 'import piper']);

let rendered = 0;
let skipped = 0;
let total = 0;
for (const lang of ['en', 'tr']) {
  const dir = join(OUT_ROOT, lang);
  mkdirSync(dir, { recursive: true });
  if (lang === 'tr' && !piperOk) {
    console.warn(
      `Piper not found in ${PIPER_DIR}: keeping the existing Turkish voice files. To set it up:\n` +
        `  python3 -m venv ${PIPER_DIR}/venv && ${PIPER_DIR}/venv/bin/pip install piper-tts\n` +
        `  curl -L -o ${PIPER_MODEL} ${PIPER_VOICE_URL}/model.onnx\n` +
        `  curl -L -o ${PIPER_MODEL}.json ${PIPER_VOICE_URL}/config.json`,
    );
    continue;
  }
  for (const key of Object.keys(TABLES.en).filter(isVoiceKey)) {
    const written = TABLES[lang][key];
    if (!written) continue;
    const text = spokenText(lang, written);
    const speakerName = speakerFor(key);
    const speaker = SPEAKERS[speakerName];
    const spec = speaker[lang];
    const out = join(dir, `${key}.ogg`);
    const hash = createHash('sha1').update(JSON.stringify({ text, speakerName, spec, voice: spec.engine === 'piper' ? PIPER_VOICE : undefined, chain: spec.chain ?? speaker.chain, noise: speaker.noise, sq: speaker.squelch })).digest('hex');
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
