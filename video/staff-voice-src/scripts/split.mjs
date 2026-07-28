#!/usr/bin/env node
// Cut the single take back into scene timings.
//
// audio/full.wav is one performance containing every scene, separated by the
// deliberate pauses tts-single.mjs asked for. This finds those pauses, keeps a
// short breath of each, and writes:
//   assets/narration.wav|mp3   the master track (one uniform tempo + one loudnorm)
//   timings.json               where each scene starts on it
//   narration.srt              subtitles
//
// The tempo correction is ONE factor for the WHOLE take. That matters: the
// original two-narrators bug came from per-line stretching, where each line got
// a different factor and so a different amount of formant smear. A single global
// factor cannot vary between scenes, so it cannot reintroduce that.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'audio', 'full.wav');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf8'));

// v1.4: NO tempo. Igor heard the v1.3 +10.6% lift as a sped-up narrator, so
// the take ships at its natural recorded pace and the video runs ~3m15
// instead of 3m00 (his call). TARGET_WPM is kept only as a guard against a
// wildly off take; the snap below turns any correction under 3% into exactly
// 1.0. Score voice consistency per take before accepting one (the v1.3 first
// take measured adj_max 3.6 dB post-EQ and was discarded).
const TARGET_WPM = 175;
const KEEP_GAP = 0.45;    // breath left between scenes (0.62 through v1.2)
const LEAD = 0.9;         // silence before the first word
const TAIL = 1.6;

const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
const dur = (f) => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8' }).stdout.trim();

if (!fs.existsSync(SRC)) { console.error('no audio/full.wav — run scripts/tts-single.mjs first'); process.exit(1); }

// --- find the inter-scene pauses -------------------------------------------
function silences(file, noise, d) {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file,
    '-af', `silencedetect=noise=${noise}:d=${d}`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
  const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  return starts.map((s, i) => ({ start: s, end: ends[i] ?? null })).filter(g => g.end != null);
}

const total = dur(SRC);
const want = cfg.scenes.length - 1;
let gaps = null;
for (const [noise, d] of [['-35dB', 1.2], ['-38dB', 1.0], ['-32dB', 1.4], ['-40dB', 0.9]]) {
  const all = silences(SRC, noise, d).filter(g => g.start > 0.5 && g.end < total - 0.3);  // drop head/tail silence
  if (all.length >= want) {
    // the N-1 longest are the scene breaks; anything shorter is a sentence pause
    gaps = all.map(g => ({ ...g, len: g.end - g.start })).sort((a, b) => b.len - a.len).slice(0, want).sort((a, b) => a.start - b.start);
    console.log(`gaps: ${all.length} found at ${noise}/${d}s, using the ${want} longest (${gaps[0].len.toFixed(1)}-${gaps[gaps.length - 1].len.toFixed(1)}s)`);
    break;
  }
  console.log(`  ${noise}/${d}s -> ${all.length} gaps, need ${want}`);
}
if (!gaps) { console.error(`could not find ${want} scene breaks. Re-run tts-single.mjs.`); process.exit(1); }

// --- speech time -> one global tempo ---------------------------------------
const words = cfg.scenes.reduce((a, s) => a + s.text.split(/\s+/).length, 0);
const gapTime = gaps.reduce((a, g) => a + g.len, 0);
const head = gaps.length ? silences(SRC, '-35dB', 1.2).filter(g => g.start < 0.5).reduce((a, g) => a + (g.end - g.start), 0) : 0;
const speech = total - gapTime - head;
const wpm = words / speech * 60;
// atempo multiplies speed: wpm_new = wpm_old * tempo. Read fast -> tempo < 1.
let tempo = Math.min(1.15, Math.max(0.82, TARGET_WPM / wpm));
if (Math.abs(tempo - 1) < 0.03) tempo = 1;   // v1.4: natural pace, no stretch
console.log(`pace: ${wpm.toFixed(0)} wpm of speech -> one global atempo of ${tempo.toFixed(3)} for ${TARGET_WPM}`);

// --- retime + normalise the whole take ONCE, then cut ----------------------
const WORK = path.join(ROOT, 'audio', '.work');
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
const body = path.join(WORK, 'body.wav');
ff(['-i', SRC, '-af', `atempo=${tempo.toFixed(4)},loudnorm=I=-16:TP=-1.5:LRA=11`, '-ar', '24000', '-ac', '1', body]);
const bodyDur = dur(body);

// Re-detect on the retimed audio rather than mapping timestamps through the
// stretch: fewer moving parts, and the thresholds are the ones that matter.
const bAll = silences(body, '-35dB', 1.2).map(g => ({ ...g, len: g.end - g.start }));
const bGaps = bAll.filter(g => g.start > 0.5 && g.end < bodyDur - 0.3)
  .sort((a, b) => b.len - a.len).slice(0, want).sort((a, b) => a.start - b.start);
if (bGaps.length !== want) { console.error(`retimed audio has ${bGaps.length} breaks, need ${want}`); process.exit(1); }
const headSil = bAll.find(g => g.start < 0.5);
const firstWord = Math.max(0, (headSil ? headSil.end : 0) - 0.05);

// Each scene is cut out of the one performance, then reassembled with a fixed
// breath between scenes, so the 4-5s pauses the model left do not ship.
const segs = [];
cfg.scenes.forEach((s, i) => {
  const from = i === 0 ? firstWord : bGaps[i - 1].end - Math.min(KEEP_GAP / 2, bGaps[i - 1].len / 3);
  const to = i < bGaps.length ? bGaps[i].start + Math.min(KEEP_GAP / 2, bGaps[i].len / 3) : bodyDur;
  const f = path.join(WORK, `seg${String(i).padStart(2, '0')}.wav`);
  ff(['-i', body, '-ss', from.toFixed(3), '-to', to.toFixed(3), '-c', 'copy', f]);
  segs.push({ id: s.id, title: s.title, text: s.text, file: f, dur: dur(f) });
});

const sil = path.join(WORK, 'gap.wav');
ff(['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(KEEP_GAP), sil]);
const lead = path.join(WORK, 'lead.wav');
ff(['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(LEAD), lead]);
const tail = path.join(WORK, 'tail.wav');
ff(['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(TAIL), tail]);

const parts = [lead];
const scenes = [];
let t = LEAD;
segs.forEach((s, i) => {
  scenes.push({ id: s.id, title: s.title, text: s.text, start: +t.toFixed(3), dur: +s.dur.toFixed(3) });
  parts.push(s.file); t += s.dur;
  if (i < segs.length - 1) { parts.push(sil); t += KEEP_GAP; }
});
parts.push(tail); t += TAIL;

const list = path.join(WORK, 'cat.txt');
fs.writeFileSync(list, parts.map(f => `file '${f}'`).join('\n'));
const master = path.join(ROOT, 'assets', 'narration.wav');
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', master]);
ff(['-i', master, '-b:a', '128k', path.join(ROOT, 'assets', 'narration.mp3')]);
fs.rmSync(WORK, { recursive: true, force: true });
const grand = +t.toFixed(3);
fs.writeFileSync(path.join(ROOT, 'timings.json'),
  JSON.stringify({ total: grand, gap: KEEP_GAP, lead: LEAD, source: 'single take', tempo: +tempo.toFixed(4), scenes }, null, 2));

// --- subtitles ---------------------------------------------------------------
const fmt = (x) => {
  const h = String(Math.floor(x / 3600)).padStart(2, '0'), m = String(Math.floor(x % 3600 / 60)).padStart(2, '0');
  const s = String(Math.floor(x % 60)).padStart(2, '0'), ms = String(Math.round((x % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
};
const srt = []; let n = 0;
for (const sc of scenes) {
  const sentences = sc.text.match(/[^.!?]+[.!?]+/g) || [sc.text];
  const tot = sentences.reduce((a, s) => a + s.split(/\s+/).length, 0);
  let cur = sc.start;
  for (const sen of sentences) {
    const share = sen.split(/\s+/).length / tot * sc.dur, from = cur, to = cur + share; cur = to;
    srt.push(`${++n}\n${fmt(from)} --> ${fmt(to)}\n${sen.trim()}\n`);
  }
}
fs.writeFileSync(path.join(ROOT, 'narration.srt'), srt.join('\n'));

console.log(`\nmaster ${grand.toFixed(1)}s (${(grand / 60).toFixed(2)} min), ${n} subtitle cues`);
scenes.forEach(s => console.log(`  ${s.id.padEnd(16)} ${String(s.start).padStart(7)}  ${s.dur}s`));
