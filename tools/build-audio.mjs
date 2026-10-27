import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'assets/audio/ambience.ogg');
const PREVIEW = join(ROOT, 'art-preview/audio-ambience.png');

const SAMPLE_RATE = 32000;
const LOOP_SECONDS = 24;
const TAIL_SECONDS = 2;
const SEED = 0x51a7e;

const LOOP_SAMPLES = LOOP_SECONDS * SAMPLE_RATE;
const TAIL_SAMPLES = TAIL_SECONDS * SAMPLE_RATE;
const TOTAL_SAMPLES = LOOP_SAMPLES + TAIL_SAMPLES;

const TARGET_PEAK = 0.5;

const VENT_RMS = 0.1;
const VENT_LOWPASS = 650;
const VENT_LOWPASS_2 = 900;
const HUM_RATIO = 0.1;
const AIR_RATIO = 0.1;
const AIR_CENTER = 1600;
const AIR_LOWPASS = 2600;
const RUMBLE_PEAK = 0.05;
const MIX_LOWPASS = 3200;
const VORBIS_QUALITY = 6;

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

function biquadLowpass(sampleRate, frequency, q) {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - cos) / 2) / a0,
    b1: (1 - cos) / a0,
    b2: ((1 - cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function biquadBandpass(sampleRate, frequency, q) {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function biquadHighpass(sampleRate, frequency, q) {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 + cos) / 2) / a0,
    b1: -(1 + cos) / a0,
    b2: ((1 + cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function applyBiquad(samples, coeff) {
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i] ?? 0;
    const y0 = coeff.b0 * x0 + coeff.b1 * x1 + coeff.b2 * x2 - coeff.a1 * y1 - coeff.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

function rms(samples) {
  let sum = 0;
  for (const value of samples) sum += value * value;
  return Math.sqrt(sum / samples.length);
}

function peak(samples) {
  let max = 0;
  for (const value of samples) max = Math.max(max, Math.abs(value));
  return max;
}

function scaleToRms(samples, target) {
  const current = rms(samples);
  if (current === 0) return samples;
  const gain = target / current;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  return samples;
}

function scaleToPeak(samples, target) {
  const current = peak(samples);
  if (current === 0) return samples;
  const gain = target / current;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  return samples;
}

function ventilation() {
  const rng = createRng(SEED);
  const white = new Float32Array(TOTAL_SAMPLES);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const value = rng() * 2 - 1;
    b0 = 0.99765 * b0 + value * 0.099046;
    b1 = 0.963 * b1 + value * 0.2965164;
    b2 = 0.57 * b2 + value * 1.0526913;
    white[i] = (b0 + b1 + b2 + value * 0.1848) * 0.25;
  }

  const filtered = applyBiquad(white, biquadLowpass(SAMPLE_RATE, VENT_LOWPASS, 0.7));
  const softened = applyBiquad(filtered, biquadLowpass(SAMPLE_RATE, VENT_LOWPASS_2, 0.7));

  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const t = i / SAMPLE_RATE;
    const breath =
      0.85 +
      0.15 * Math.sin(2 * Math.PI * 0.07 * t) +
      0.1 * Math.sin(2 * Math.PI * 0.031 * t + 1.7);
    softened[i] *= breath;
  }

  return scaleToRms(softened, VENT_RMS);
}

function air() {
  const rng = createRng(SEED ^ 0xa17);
  const white = new Float32Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i += 1) white[i] = rng() * 2 - 1;

  const banded = applyBiquad(white, biquadBandpass(SAMPLE_RATE, AIR_CENTER, 0.5));
  const edged = applyBiquad(banded, biquadLowpass(SAMPLE_RATE, AIR_LOWPASS, 0.7));

  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const t = i / SAMPLE_RATE;
    edged[i] *= 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.041 * t + 0.9);
  }

  return scaleToRms(edged, VENT_RMS * AIR_RATIO);
}

function hum() {
  const out = new Float32Array(TOTAL_SAMPLES);
  const partials = [
    { frequency: 50, amplitude: 1, wobble: 0.1, rate: 0.043 },
    { frequency: 100, amplitude: 0.3, wobble: 0.14, rate: 0.061 },
    { frequency: 150, amplitude: 0.08, wobble: 0.18, rate: 0.029 },
    { frequency: 250, amplitude: 0.02, wobble: 0.2, rate: 0.017 },
  ];

  for (const partial of partials) {
    const phase = (partial.frequency * 1000) % 7;
    for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
      const t = i / SAMPLE_RATE;
      const amp =
        partial.amplitude *
        (1 + partial.wobble * Math.sin(2 * Math.PI * partial.rate * t + phase));
      out[i] += amp * Math.sin(2 * Math.PI * partial.frequency * t);
    }
  }

  return scaleToRms(out, VENT_RMS * HUM_RATIO);
}

function rumbles() {
  const rng = createRng(SEED ^ 0x7a1);
  const out = new Float32Array(TOTAL_SAMPLES);
  const events = 1;

  for (let event = 0; event < events; event += 1) {
    const start = 4 + rng() * (LOOP_SECONDS - 10);
    const length = 0.9 + rng() * 0.6;
    const gain = RUMBLE_PEAK * (0.8 + rng() * 0.4);
    const center = 110 + rng() * 90;
    const startSample = Math.floor(start * SAMPLE_RATE);
    const lengthSamples = Math.floor(length * SAMPLE_RATE);

    const noise = new Float32Array(lengthSamples);
    for (let i = 0; i < lengthSamples; i += 1) noise[i] = rng() * 2 - 1;
    const banded = applyBiquad(noise, biquadBandpass(SAMPLE_RATE, center, 1.1));

    for (let i = 0; i < lengthSamples; i += 1) {
      const u = i / lengthSamples;
      const envelope = Math.sin(Math.PI * Math.pow(u, 0.6)) ** 2;
      const index = startSample + i;
      if (index < TOTAL_SAMPLES) out[index] += (banded[i] ?? 0) * envelope * gain;
    }
  }

  return out;
}

function mix() {
  const vent = ventilation();
  const mains = hum();
  const whispers = air();
  const bumps = rumbles();

  const raw = new Float32Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    raw[i] = (vent[i] ?? 0) + (mains[i] ?? 0) + (whispers[i] ?? 0) + (bumps[i] ?? 0);
  }

  const highpassed = applyBiquad(raw, biquadHighpass(SAMPLE_RATE, 35, 0.7));
  const lowpassed = applyBiquad(highpassed, biquadLowpass(SAMPLE_RATE, MIX_LOWPASS, 0.5));
  return scaleToPeak(lowpassed, TARGET_PEAK);
}

function crossfadeLoop(input) {
  const out = new Float32Array(LOOP_SAMPLES);
  const span = TAIL_SAMPLES;

  for (let i = 0; i < LOOP_SAMPLES; i += 1) {
    const head = input[i] ?? 0;
    const tail = input[i + LOOP_SAMPLES] ?? 0;
    if (i >= span) {
      out[i] = head;
      continue;
    }
    const u = i / span;
    const fadeIn = Math.sin((Math.PI / 2) * u);
    const fadeOut = Math.cos((Math.PI / 2) * u);
    out[i] = head * fadeIn + tail * fadeOut;
  }

  return out;
}

function writeWav(path, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buffer);
}

function readWavMono(path) {
  const buffer = readFileSync(path);
  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  let channels = 1;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') channels = buffer.readUInt16LE(offset + 10);
    if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }

  if (dataOffset < 0) throw new Error('wav data chunk missing');
  const frames = Math.floor(dataSize / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    samples[i] = buffer.readInt16LE(dataOffset + i * 2 * channels) / 32768;
  }
  return samples;
}

function toDb(value) {
  return value <= 0 ? -Infinity : 20 * Math.log10(value);
}

function describe(samples) {
  let sum = 0;
  let max = 0;
  for (const value of samples) {
    sum += value;
    max = Math.max(max, Math.abs(value));
  }
  return {
    peak: toDb(max),
    rms: toDb(rms(samples)),
    dc: sum / samples.length,
  };
}

function seamReport(samples) {
  const count = 200;
  let diffSum = 0;
  for (let i = 1; i < count; i += 1) {
    diffSum += Math.abs((samples[i] ?? 0) - (samples[i - 1] ?? 0));
  }
  const averageStep = diffSum / (count - 1);
  const jump = Math.abs((samples[0] ?? 0) - (samples[samples.length - 1] ?? 0));
  return { jump, averageStep, ratio: averageStep === 0 ? 0 : jump / averageStep };
}

function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curReal = 1;
      let curImag = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const evenReal = real[i + k];
        const evenImag = imag[i + k];
        const oddReal = real[i + k + len / 2] * curReal - imag[i + k + len / 2] * curImag;
        const oddImag = real[i + k + len / 2] * curImag + imag[i + k + len / 2] * curReal;
        real[i + k] = evenReal + oddReal;
        imag[i + k] = evenImag + oddImag;
        real[i + k + len / 2] = evenReal - oddReal;
        imag[i + k + len / 2] = evenImag - oddImag;
        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }
}

async function writeSpectrogram(path, samples) {
  const fftSize = 2048;
  const hop = 512;
  const columns = 600;
  const rows = 320;
  const minFrequency = 20;
  const maxFrequency = 8000;
  const minDb = -95;
  const maxDb = -20;

  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  }

  const frames = Math.floor((samples.length - fftSize) / hop);
  const bins = new Float32Array(rows * frames);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  const binFrequency = SAMPLE_RATE / fftSize;

  for (let frame = 0; frame < frames; frame += 1) {
    for (let i = 0; i < fftSize; i += 1) {
      real[i] = (samples[frame * hop + i] ?? 0) * window[i];
      imag[i] = 0;
    }
    fft(real, imag);
    for (let row = 0; row < rows; row += 1) {
      const t = row / (rows - 1);
      const frequency = minFrequency * Math.pow(maxFrequency / minFrequency, 1 - t);
      const bin = Math.min(fftSize / 2 - 1, Math.round(frequency / binFrequency));
      const magnitude = Math.hypot(real[bin] ?? 0, imag[bin] ?? 0) / fftSize;
      bins[row * frames + frame] = toDb(magnitude);
    }
  }

  const pixels = Buffer.alloc(columns * rows * 3);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const start = Math.floor((column * frames) / columns);
      const end = Math.max(start + 1, Math.floor(((column + 1) * frames) / columns));
      let value = -Infinity;
      for (let frame = start; frame < end; frame += 1) {
        value = Math.max(value, bins[row * frames + frame] ?? -Infinity);
      }
      const t = Math.max(0, Math.min(1, (value - minDb) / (maxDb - minDb)));
      const index = (row * columns + column) * 3;
      pixels[index] = Math.round(250 * Math.pow(t, 1.35));
      pixels[index + 1] = Math.round(196 * Math.pow(t, 1.65));
      pixels[index + 2] = Math.round(96 * Math.pow(t, 2.2));
    }
  }

  await sharp(pixels, { raw: { width: columns, height: rows, channels: 3 } })
    .png()
    .toFile(path);
}

const loop = crossfadeLoop(mix());
const before = describe(loop);

const workDir = join(tmpdir(), 'station-zero-audio');
mkdirSync(workDir, { recursive: true });
const sourceWav = join(workDir, 'ambience.wav');
const decodedWav = join(workDir, 'ambience-decoded.wav');
writeWav(sourceWav, loop);

mkdirSync(dirname(OUTPUT), { recursive: true });
execFileSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-i', sourceWav, '-c:a', 'libvorbis', '-q:a', String(VORBIS_QUALITY), '-ar', String(SAMPLE_RATE), '-ac', '1', OUTPUT],
  { stdio: 'inherit' },
);
execFileSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-i', OUTPUT, '-c:a', 'pcm_s16le', '-ar', String(SAMPLE_RATE), '-ac', '1', decodedWav],
  { stdio: 'inherit' },
);

const decoded = readWavMono(decodedWav);
const seam = seamReport(loop);
const decodedSeam = seamReport(decoded);
const encodedBytes = statSync(OUTPUT).size;

let leading = 0;
while (leading < decoded.length && Math.abs(decoded[leading] ?? 0) < 0.0005) leading += 1;

mkdirSync(dirname(PREVIEW), { recursive: true });
await writeSpectrogram(PREVIEW, loop);
rmSync(workDir, { recursive: true, force: true });

const report = {
  source: {
    seconds: LOOP_SECONDS,
    sampleRate: SAMPLE_RATE,
    peakDb: Number(before.peak.toFixed(2)),
    rmsDb: Number(before.rms.toFixed(2)),
    dcOffset: Number(before.dc.toFixed(6)),
  },
  loop: {
    jump: Number(seam.jump.toFixed(6)),
    averageStep: Number(seam.averageStep.toFixed(6)),
    jumpVsAverageStep: Number(seam.ratio.toFixed(2)),
  },
  encoded: {
    bytes: encodedBytes,
    decodedFrames: decoded.length,
    expectedFrames: LOOP_SAMPLES,
    paddingFrames: decoded.length - LOOP_SAMPLES,
    leadingSilentFrames: leading,
    jumpVsAverageStep: Number(decodedSeam.ratio.toFixed(2)),
  },
  spectrogram: PREVIEW,
  output: OUTPUT,
};

console.log(JSON.stringify(report, null, 2));
