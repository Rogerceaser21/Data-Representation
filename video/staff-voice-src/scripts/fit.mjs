#!/usr/bin/env node
// Trim silence, even out the pace to one target wpm, normalise loudness, then
// concatenate into a single narration track with fixed gaps. Writes timings.json
// (scene start/duration on the master track) and narration.srt.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const A = path.join(ROOT, 'audio');
const N = path.join(A, 'norm');
fs.mkdirSync(N, { recursive: true });

const TARGET_WPM = 165;
const GAP = 0.62;        // breath between scenes
const LEAD = 0.9;        // silence before the first word

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf8'));
const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1', f]).toString().trim();

const rows = [];
for (const s of cfg.scenes) {
  const src = path.join(A, `${s.id}.wav`);
  const trimmed = path.join(N, `${s.id}.trim.wav`);
  ff(['-i', src, '-af',
    'silenceremove=start_periods=1:start_silence=0.06:start_threshold=-45dB:detection=peak,areverse,' +
    'silenceremove=start_periods=1:start_silence=0.10:start_threshold=-45dB:detection=peak,areverse',
    trimmed]);
  const words = s.text.split(/\s+/).length;
  const d0 = dur(trimmed);
  // atempo multiplies speed: wpm_new = wpm_old * tempo. Read fast -> tempo < 1.
  // HARD CAP at +/-3%: beyond that the stretch smears the formants and the line
  // stops sounding like the same narrator (the v1 bug). Pace is fixed in tts.mjs
  // by re-asking for the take, not here.
  let tempo = TARGET_WPM / (words / d0 * 60);
  tempo = Math.min(1.03, Math.max(0.97, tempo));
  const out = path.join(N, `${s.id}.wav`);
  ff(['-i', trimmed, '-af', `atempo=${tempo.toFixed(4)},loudnorm=I=-16:TP=-1.5:LRA=11`, '-ar', '24000', '-ac', '1', out]);
  fs.unlinkSync(trimmed);
  const d = dur(out);
  rows.push({ ...s, wav: out, dur: +d.toFixed(3), wpm: Math.round(words / d * 60), tempo: +tempo.toFixed(3) });
  console.log(`${s.id.padEnd(16)} ${d0.toFixed(2)}s -> ${d.toFixed(2)}s  tempo ${tempo.toFixed(3)}  ${Math.round(words / d * 60)} wpm`);
}

// concat with gaps
const sil = path.join(N, '_gap.wav');
ff(['-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono`, '-t', String(GAP), sil]);
const lead = path.join(N, '_lead.wav');
ff(['-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono`, '-t', String(LEAD), lead]);

const list = [lead];
let t = LEAD;
const timeline = [];
rows.forEach((r, i) => {
  timeline.push({ id: r.id, title: r.title, text: r.text, start: +t.toFixed(3), dur: r.dur });
  t += r.dur;
  list.push(r.wav);
  if (i < rows.length - 1) { list.push(sil); t += GAP; }
});
const TAIL = 1.6;
const tail = path.join(N, '_tail.wav');
ff(['-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono`, '-t', String(TAIL), tail]);
list.push(tail); t += TAIL;

const listFile = path.join(N, 'concat.txt');
fs.writeFileSync(listFile, list.map(f => `file '${f}'`).join('\n'));
const master = path.join(ROOT, 'assets', 'narration.wav');
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', master]);
const masterMp3 = path.join(ROOT, 'assets', 'narration.mp3');
ff(['-i', master, '-b:a', '128k', masterMp3]);

fs.writeFileSync(path.join(ROOT, 'timings.json'),
  JSON.stringify({ total: +t.toFixed(3), gap: GAP, lead: LEAD, scenes: timeline }, null, 2));

// SRT, one cue per sentence, split proportionally by word count inside each scene
const srt = [];
let n = 0;
for (const sc of timeline) {
  const sentences = sc.text.match(/[^.!?]+[.!?]+/g) || [sc.text];
  const tot = sentences.reduce((a, s) => a + s.split(/\s+/).length, 0);
  let cur = sc.start;
  for (const sen of sentences) {
    const share = sen.split(/\s+/).length / tot * sc.dur;
    const from = cur, to = cur + share;
    cur = to;
    const fmt = (x) => {
      const h = String(Math.floor(x / 3600)).padStart(2, '0');
      const m = String(Math.floor(x % 3600 / 60)).padStart(2, '0');
      const s = String(Math.floor(x % 60)).padStart(2, '0');
      const ms = String(Math.round((x % 1) * 1000)).padStart(3, '0');
      return `${h}:${m}:${s},${ms}`;
    };
    srt.push(`${++n}\n${fmt(from)} --> ${fmt(to)}\n${sen.trim()}\n`);
  }
}
fs.writeFileSync(path.join(ROOT, 'narration.srt'), srt.join('\n'));
console.log(`\nmaster ${t.toFixed(1)}s (${(t / 60).toFixed(2)} min) -> assets/narration.wav + .mp3, ${n} subtitle cues`);
