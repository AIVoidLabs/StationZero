import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SAMPLE_RATE = 32000;
const LOOP_SECONDS = 40;
const TOTAL = SAMPLE_RATE * LOOP_SECONDS;
const TARGET_PEAK = 0.5;
const TAU = Math.PI * 2;

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// every component frequency is k / LOOP_SECONDS so the loop closes on a whole cycle
function loopFreq(hz) {
  return Math.round(hz * LOOP_SECONDS) / LOOP_SECONDS;
}

function onePole(samples, cutoff) {
  const a = 1 - Math.exp((-TAU * cutoff) / SAMPLE_RATE);
  const out = new Float32Array(samples.length);
  let y = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < samples.length; i += 1) {
      y += a * (samples[i] - y);
      if (pass === 1) out[i] = y;
    }
  }
  return out;
}

function drone(freqs, lfos) {
  const out = new Float32Array(TOTAL);
  for (let i = 0; i < TOTAL; i += 1) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const [hz, amp] of freqs) {
      const f = loopFreq(hz);
      const saw = 2 * ((t * f) % 1) - 1;
      s += (Math.sin(TAU * f * t) * 0.7 + saw * 0.3) * amp;
    }
    let swell = 0.7;
    for (const [hz, depth, phase] of lfos) swell += Math.sin(TAU * loopFreq(hz) * t + phase) * depth;
    out[i] = s * swell;
  }
  return out;
}

function addThump(out, start, hz0, hz1, seconds, amp) {
  const length = Math.min(Math.floor(seconds * SAMPLE_RATE), TOTAL - start);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const hz = hz1 + (hz0 - hz1) * Math.exp(-t * 7);
    phase += (TAU * hz) / SAMPLE_RATE;
    out[start + i] += Math.sin(phase) * Math.exp(-t * 3.2) * amp * Math.min(1, t * 200);
  }
}

function addTick(out, start, hz, seconds, amp) {
  const length = Math.min(Math.floor(seconds * SAMPLE_RATE), TOTAL - start);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 28) * Math.min(1, t * 800);
    out[start + i] += (Math.sin(TAU * hz * t) + 0.5 * Math.sin(TAU * hz * 2.76 * t)) * env * amp;
  }
}

function scaleToPeak(samples, target) {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? target / peak : 1;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= k;
}

function menuTheme() {
  const rng = createRng(0x71e3);
  const base = drone(
    [
      [55, 0.5],
      [55.075, 0.3],
      [54.925, 0.3],
      [82.5, 0.22],
      [110, 0.1],
    ],
    [
      [0.05, 0.22, 0],
      [0.075, 0.12, 1.3],
    ],
  );
  const mix = onePole(base, 520);
  for (let beat = 0; beat < 8; beat += 1) {
    addThump(mix, Math.floor(beat * 5 * SAMPLE_RATE + 0.4 * SAMPLE_RATE), 62, 38, 1.8, 0.34);
    addThump(mix, Math.floor((beat * 5 + 2.5) * SAMPLE_RATE + 0.4 * SAMPLE_RATE), 52, 36, 1.4, 0.16);
  }
  for (let i = 0; i < 9; i += 1) {
    const at = 1 + rng() * 36;
    const hz = 1900 + rng() * 1600;
    addTick(mix, Math.floor(at * SAMPLE_RATE), hz, 0.5, 0.05 + rng() * 0.03);
    addTick(mix, Math.floor((at + 0.37) * SAMPLE_RATE), hz, 0.5, 0.02);
  }
  scaleToPeak(mix, TARGET_PEAK);
  return mix;
}

function endTheme() {
  const rng = createRng(0x2f9a);
  const base = drone(
    [
      [55, 0.5],
      [58.25, 0.35],
      [110.5, 0.12],
      [220, 0.05],
    ],
    [
      [0.025, 0.3, 0.6],
      [0.05, 0.1, 2.1],
    ],
  );
  const mix = onePole(base, 420);
  addThump(mix, Math.floor(1 * SAMPLE_RATE), 46, 32, 3, 0.2);
  addThump(mix, Math.floor(21 * SAMPLE_RATE), 46, 32, 3, 0.2);
  for (let i = 0; i < 4; i += 1) {
    const at = 3 + rng() * 32;
    addTick(mix, Math.floor(at * SAMPLE_RATE), 1500 + rng() * 900, 0.6, 0.05);
  }
  scaleToPeak(mix, TARGET_PEAK);
  return mix;
}

function writeWav(path, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  writeFileSync(path, buffer);
}

const workDir = join(tmpdir(), 'station-zero-music');
mkdirSync(workDir, { recursive: true });
mkdirSync(join(ROOT, 'assets/audio'), { recursive: true });

for (const [name, samples] of [
  ['music_menu', menuTheme()],
  ['music_end', endTheme()],
]) {
  const wav = join(workDir, `${name}.wav`);
  const ogg = join(ROOT, 'assets/audio', `${name}.ogg`);
  writeWav(wav, samples);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', '-ar', String(SAMPLE_RATE), '-ac', '1', ogg], { stdio: 'inherit' });
  console.log(`${name}.ogg ${(statSync(ogg).size / 1024).toFixed(0)} KB`);
}
rmSync(workDir, { recursive: true, force: true });
