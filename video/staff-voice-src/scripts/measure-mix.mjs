#!/usr/bin/env node
// Prove the duck-mix on the INGREDIENTS before the render exists.
//
// Reads timings.json, then measures assets/music.mp3 in the regions that matter:
// the cold-open lead, every music-only HOLD, a speech window in each act, and the
// silent end card. Plus narration integrated loudness. -ss goes BEFORE -i so the
// region is what it says it is.
//
// Usage: node scripts/measure-mix.mjs [TOTAL]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'timings.json'), 'utf8'));
const MUSIC = path.join(ROOT, 'assets', 'music.mp3');
const NARR = path.join(ROOT, 'assets', 'narration.wav');
const TAIL = 1.6, ENDCARD = 8;
const TOTAL = process.argv[2] ? +process.argv[2] : Math.ceil(t.total + TAIL) + ENDCARD;

const mean = (file, from, len) => {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(from), '-t', String(len),
    '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  const m = out.match(/mean_volume: (-?[\d.]+) dB/), p = out.match(/max_volume: (-?[\d.]+) dB/);
  return { mean: m ? +m[1] : NaN, max: p ? +p[1] : NaN };
};
const lufs = (file) => {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file,
    '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  return { I: (out.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1], LRA: (out.match(/LRA:\s+([\d.]+) LU/) || [])[1] };
};
const row = (label, file, from, len) => {
  const v = mean(file, from, len);
  console.log(`  ${label.padEnd(34)} ${from.toFixed(2).padStart(7)}s +${len.toFixed(2)}s   mean ${v.mean.toFixed(1).padStart(6)} dB   max ${v.max.toFixed(1).padStart(6)} dB`);
  return v;
};

const byId = Object.fromEntries(t.scenes.map(s => [s.id, s]));
console.log(`TOTAL ${TOTAL}s · narration master ${t.total}s · music ${(+spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', MUSIC], { encoding: 'utf8' }).stdout.trim()).toFixed(2)}s`);

console.log('\nMUSIC-ONLY REGIONS (bed should LIFT here):');
row('lead / cold open', MUSIC, 0.2, Math.max(0.5, t.lead - 0.4));
for (const [id, len] of Object.entries(t.holds || {})) {
  const s = byId[id];
  if (!s) continue;
  row(`hold after ${id}`, MUSIC, s.start + s.dur + 0.15, Math.max(0.5, len - 0.3));
}
const lastEnd = t.scenes[t.scenes.length - 1].start + t.scenes[t.scenes.length - 1].dur;
row('tail (after last word)', MUSIC, lastEnd + 0.15, Math.max(0.5, t.total - lastEnd - 0.3));
row('end card (silent picture)', MUSIC, TOTAL - ENDCARD + 0.2, ENDCARD - 1.2);

console.log('\nUNDER SPEECH (bed should DUCK here):');
for (const id of ['s05_loop', 's09_strategies', 's15_corner', 's11_middle']) {
  const s = byId[id];
  if (s) row(`under ${id}`, MUSIC, s.start + 1.0, Math.min(10, s.dur - 2));
}

console.log('\nNARRATION:');
const nl = lufs(NARR);
console.log(`  integrated ${nl.I} LUFS   LRA ${nl.LRA} LU`);
const ml = lufs(MUSIC);
console.log(`  music integrated ${ml.I} LUFS   LRA ${ml.LRA} LU  (post-duck, whole file)`);
