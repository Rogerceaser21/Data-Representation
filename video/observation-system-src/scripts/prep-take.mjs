#!/usr/bin/env node
// The v2.3 field repairs, runnable. Run BEFORE split.mjs when a take will not cut.
// Reads a candidate take, writes audio/full.wav (split.mjs's input). Never edits text,
// never stretches, never regenerates: it only removes dead air and flattens the noise
// inside pauses the model already performed.
//
//   1. TAIL TRIM. Gemini sometimes appends minutes of dead air after the last word
//      (r1 take 1: 215s). split.mjs's head/tail filter only drops silence touching the
//      very end, so a 64s dead-air block becomes a candidate "scene break" and shifts
//      every boundary after it. Cut just after the last word instead.
//   2. HARD GATE. A breath tick inside an inter-scene pause splits it into two short
//      silences, so the pause stops reading as one gap and the take looks unsplittable.
//      Gating everything under the speech floor to true digital silence fuses them back.
//
// Usage: node scripts/prep-take.mjs audio/<take>.wav [--gate]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const IN = path.resolve(process.argv[2] || '');
const GATE = process.argv.includes('--gate');
if (!IN || !fs.existsSync(IN)) { console.error('usage: node scripts/prep-take.mjs audio/<take>.wav [--gate]'); process.exit(1); }

const run = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
};
const dur = (f) => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const sils = (f, noise = '-35dB', d = 0.8) => {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f,
    '-af', `silencedetect=noise=${noise}:d=${d}`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  const s = [...out.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
  const e = [...out.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  return s.map((x, i) => ({ start: x, end: e[i] ?? null, len: (e[i] ?? null) === null ? null : e[i] - x }));
};

const total = dur(IN);
const all = sils(IN);
// The dead tail is the maximal CHAIN of silences reaching EOF: a >6s silence counts as
// part of it when only silence (or a tick under 1.5s) separates it from the next one.
// lastWord = where that chain starts.
let lastWord = total;
for (let i = all.length - 1; i >= 0; i--) {
  const g = all[i], end = g.end ?? total;
  const reachesTail = end >= lastWord - 1.5;          // nothing but a tick between this silence and the tail
  if (!reachesTail) break;
  if (end >= total - 0.25 || g.len > 6) { lastWord = g.start; continue; }
  break;
}
const cut = Math.min(total, +(lastWord + 0.8).toFixed(3));
const stage1 = path.join(ROOT, 'audio', '.prep-trim.wav');
run(['-i', IN, '-t', String(cut), '-c', 'copy', stage1]);
console.log(`tail trim: ${total.toFixed(1)}s -> ${dur(stage1).toFixed(1)}s (last word ~${lastWord.toFixed(1)}s)`);

const OUT = path.join(ROOT, 'audio', 'full.wav');
if (GATE) {
  // agate below the speech floor: pauses become digital silence, so breath ticks
  // cannot split one inter-scene pause into two under-length silences.
  run(['-i', stage1, '-af', 'agate=threshold=0.010:ratio=9000:attack=5:release=180:knee=1', '-ar', '24000', '-ac', '1', OUT]);
  const before = sils(stage1, '-35dB', 1.2).filter(g => g.len && g.len >= 1.2).length;
  const after = sils(OUT, '-35dB', 1.2).filter(g => g.len && g.len >= 1.2).length;
  console.log(`hard gate: silences >=1.2s  ${before} -> ${after}`);
} else {
  run(['-i', stage1, '-ar', '24000', '-ac', '1', OUT]);
}
fs.rmSync(stage1, { force: true });
console.log(`wrote audio/full.wav  ${dur(OUT).toFixed(1)}s   next: node scripts/split.mjs`);
