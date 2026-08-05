#!/usr/bin/env node
// Steps 5+6 of the audio pipeline, in the one order that works.
//
// 1. PAD THE NARRATION MASTER TO TOTAL. build.mjs mounts narration as a clip of
//    data-duration={{TOTAL}} = ceil(timings.total + TAIL) + ENDCARD. If the file is
//    shorter, hyperframes check raises clip_media_fit and the end card can ship
//    without its bed. Padding is digital silence, so it also releases the ducker
//    over the end card, which is what lifts the bed there.
// 2. RE-BAKE THE BED from the irreplaceable raw Lyria stem (never regenerate it:
//    Lyria is non-deterministic). loop -> highpass 240 -> gain to ~-19 LUFS ->
//    sidechaincompress keyed by the padded narration -> fade in 1.5 / out 6 at TOTAL.
//
// ffmpeg notes earned: -ss before -i for region measures; sidechaincompress makeup
// minimum is 1 (a multiplier, not dB) so it is omitted; every -filter_complex output
// needs its own -map; the key stream is resampled/upmixed explicitly so framesync
// cannot silently change the level the ducker sees.
//
// Usage: node scripts/finish-audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'timings.json'), 'utf8'));
const TAIL = 1.6, ENDCARD = 8;                     // must match scripts/build.mjs
const TOTAL = Math.ceil(t.total + TAIL) + ENDCARD;

const RAW = path.join(ROOT, 'assets', 'music-src', 'drive1-raw-lyria.mp3');
const WORK = path.join(ROOT, 'audio', '.music');
const LOOP = path.join(WORK, 'loop.wav');
const NWAV = path.join(ROOT, 'assets', 'narration.wav');
const NMP3 = path.join(ROOT, 'assets', 'narration.mp3');
const MUSIC = path.join(ROOT, 'assets', 'music.mp3');
fs.mkdirSync(WORK, { recursive: true });

const run = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
};
const dur = (f) => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const lufs = (file, af) => {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', af, '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  return +(out.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1];
};

console.log(`TOTAL ${TOTAL}s (narration master ${t.total}s + tail ${TAIL} + end card ${ENDCARD})`);

// --- 1. narration padded to TOTAL -------------------------------------------
// +0.3s of margin past TOTAL: mp3 frame rounding can land a hair SHORT of the slot,
// and hyperframes check flags a clip whose media is shorter than its data-duration
// (clip_media_fit). The margin is silence past the composition end, so nothing plays it.
const MARGIN = 0.3;
const pre = dur(NWAV);
const padded = path.join(WORK, 'narration-padded.wav');
run(['-i', NWAV, '-af', `apad=whole_dur=${TOTAL + MARGIN}`, '-ar', '24000', '-ac', '1', padded]);
fs.copyFileSync(padded, NWAV);
run(['-i', NWAV, '-b:a', '128k', NMP3]);
console.log(`narration: ${pre.toFixed(2)}s -> ${dur(NWAV).toFixed(2)}s (wav) / ${dur(NMP3).toFixed(2)}s (mp3)`);

// --- 2. bed: loop long enough, then duck ------------------------------------
const rawDur = dur(RAW);
const copies = Math.max(2, Math.ceil((TOTAL + 8) / (rawDur - 4)));
if (!fs.existsSync(LOOP) || dur(LOOP) < TOTAL) {
  const ins = [], parts = [];
  for (let i = 0; i < copies; i++) ins.push('-i', RAW);
  for (let i = 1; i < copies; i++) {
    const a = i === 1 ? '[0:a]' : `[a${i - 1}]`;
    parts.push(`${a}[${i}:a]acrossfade=d=4:c1=tri:c2=tri${i === copies - 1 ? '[loop]' : `[a${i}]`}`);
  }
  run([...ins, '-filter_complex', parts.join(';'), '-map', '[loop]', '-ar', '44100', '-ac', '2', LOOP]);
}
console.log(`loop: ${copies} x ${rawDur.toFixed(1)}s raw stem -> ${dur(LOOP).toFixed(1)}s`);

const bedI = lufs(LOOP, 'highpass=f=240,ebur128=framelog=quiet');
const GAIN = +(-19 - bedI).toFixed(2);
console.log(`bed post-highpass ${bedI} LUFS -> gain ${GAIN >= 0 ? '+' : ''}${GAIN} dB for -19 LUFS`);

const fadeOut = +(TOTAL - 6).toFixed(2);
run(['-i', LOOP, '-i', NWAV, '-filter_complex',
  `[0:a]atrim=0:${TOTAL},highpass=f=240,volume=${GAIN}dB[m];` +
  `[1:a]aresample=44100,pan=stereo|c0=c0|c1=c0,apad=whole_dur=${TOTAL}[key];` +
  `[m][key]sidechaincompress=threshold=0.02:ratio=8:attack=120:release=550[duck];` +
  `[duck]afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOut}:d=6,apad=whole_dur=${TOTAL + MARGIN}[out]`,
  '-map', '[out]', '-ar', '44100', '-b:a', '192k', MUSIC]);
console.log(`music: ${dur(MUSIC).toFixed(2)}s  (fade in 1.5s, fade out 6s ending at ${TOTAL}s)`);
console.log('next: node scripts/measure-mix.mjs');
