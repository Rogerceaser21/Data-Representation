#!/usr/bin/env node
// The ramp-law instrument: per-scene SPEECH wpm on the finished master.
//
// GROSS wpm (words / clip seconds) is what split.mjs's brake works on. SPEECH wpm
// (words / VOICED seconds, intra-scene pauses removed) is what the ear tracks: a
// pausy scene and a rushed scene can share a gross wpm. Read the column as a CURVE
// against the opening, never as an average (2026-08-04, v2.3 shipped a 159->210 ramp
// whose average looked fine).
//
// THE REFERENCE IS THE FIRST SUBSTANTIAL SCENE ONLY, BAND +15% (2026-08-08). Taking
// max() over the first TWO substantial scenes let an already-accelerated scene set the
// bar: on the focus-os promo the cover was under 20 words, so scenes 2 and 3 were the
// "first two", scene 3 was the accelerated one (150/168/217/221) and nothing tripped.
// This verdict is PART OF TAKE ACCEPTANCE, not a printout to read afterwards.
//
// Usage: node scripts/pacecurve.mjs [assets/narration.wav]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WAV = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'assets', 'narration.wav');
const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'timings.json'), 'utf8'));

const silSum = (file, from, to) => {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(from), '-to', String(to),
    '-i', file, '-af', 'silencedetect=noise=-35dB:d=0.20', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  return [...out.matchAll(/silence_duration: ([\d.]+)/g)].reduce((a, m) => a + +m[1], 0);
};

const rows = t.scenes.map(s => {
  const w = s.text.trim().split(/\s+/).length;
  const sil = silSum(WAV, s.start, s.start + s.dur);
  const voiced = s.dur - sil;
  return { id: s.id, w, dur: s.dur, sil: +sil.toFixed(2), voiced: +voiced.toFixed(2), gross: w / (s.dur / 60), speech: w / (voiced / 60) };
});

const sub = rows.filter(r => r.w >= 20);
if (!sub.length) { console.error('no scene has >=20 words: nothing to calibrate against'); process.exit(1); }
const openSpeech = sub[0].speech;                 // FIRST substantial scene only, never a max
const openGross = sub[0].gross;
const band = openSpeech * 1.15;

console.log(`scene            words   clip   voiced  gross  SPEECH   vs opening`);
for (const r of rows) {
  const rel = (r.speech / openSpeech - 1) * 100;
  const flag = r.w >= 20 && r.speech > band ? '  OVER BAND' : '';
  console.log(`${r.id.padEnd(16)} ${String(r.w).padStart(4)} ${r.dur.toFixed(1).padStart(7)} ${r.voiced.toFixed(1).padStart(7)}` +
    ` ${r.gross.toFixed(0).padStart(6)} ${r.speech.toFixed(0).padStart(7)}   ${(rel >= 0 ? '+' : '') + rel.toFixed(0)}%${flag}`);
}
const words = rows.reduce((a, r) => a + r.w, 0), voiced = rows.reduce((a, r) => a + r.voiced, 0);
console.log(`\nreference (FIRST >=20-word scene, ${sub[0].id}): SPEECH ${openSpeech.toFixed(0)} wpm, gross ${openGross.toFixed(0)} wpm` +
  `  ->  accept band <= ${band.toFixed(0)} SPEECH wpm (+15%)`);
console.log(`take mean SPEECH wpm ${(words / (voiced / 60)).toFixed(0)} (AVERAGES LIE - the curve above is the verdict)`);
const over = rows.filter(r => r.w >= 20 && r.speech > band);
console.log(over.length
  ? `OVER BAND: ${over.map(r => `${r.id} ${r.speech.toFixed(0)}`).join(', ')}  -> BIN THE TAKE or present the numbers to Igor`
  : 'all substantial scenes inside the band');
process.exit(over.length ? 1 : 0);
