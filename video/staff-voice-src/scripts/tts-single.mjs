#!/usr/bin/env node
// ONE request for the whole script. This is the fix for the two-narrators problem.
//
// Why: Gemini TTS re-derives speaker identity from context on every request, so
// separate calls give separate performances even with an identical voice config
// and an identical director prompt. Google documents the symptom ("the model's
// output may not always strictly match the selected speaker") and offers no
// determinism control: Vertex states the API *ignores* temperature/top_k/top_p,
// and no seed behaviour is documented for TTS. Google staff acknowledged the
// drift on their own forum in Sept 2025 and again in June 2026; it is unfixed.
// The workaround practitioners actually ship is one request, split afterwards.
//
// Scenes are separated by an explicit pause tag so the take can be cut back into
// per-scene clips. split.mjs does the cutting and writes timings.json.
//
// Guards: Gemini TTS intermittently truncates (finishReason OTHER) or returns
// text tokens instead of audio (500). Both are retried, and a take that comes
// back far shorter than the script implies is rejected rather than shipped.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const AUDIO = path.join(ROOT, 'audio');
fs.mkdirSync(AUDIO, { recursive: true });

const GAP_TAG = '[pause 3 seconds]';
const WPM_FLOOR = 210;      // a real take is never faster than this; below it, we were truncated
const MAX_TRIES = 5;

const envTxt = fs.readFileSync(path.join(os.homedir(), 'AIS-Data-Dashboard/.env'), 'utf8');
const KEY = (envTxt.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error('no GEMINI_API_KEY in ~/AIS-Data-Dashboard/.env'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf8'));
const words = cfg.scenes.reduce((a, s) => a + s.text.split(/\s+/).length, 0);

// One prompt: the director's note once, then every scene, separated by a pause.
const script = cfg.scenes.map(s => s.text).join(`\n\n${GAP_TAG}\n\n`);
const SLOWER = [
  '',
  'Take your time. Leave a clear beat at every full stop. ',
  'Deliberately slow and unhurried, as if reading aloud to a room. A full beat at every full stop, a shorter one at every comma. ',
  'Very measured and deliberate. Pause noticeably at every full stop. Do not rush any sentence. '
];
const promptFor = (round) => cfg.note.replace('Say only the text after the colon:', SLOWER[Math.min(round, 3)] + 'Say only the text after the colon:') + script;

// Speech rate has to be measured against speaking time, not wall time: the take
// contains ~13 deliberate inter-scene pauses that would otherwise flatter it.
function speechSeconds(file, total) {
  // silencedetect reports on stderr, not stdout
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file,
    '-af', 'silencedetect=noise=-35dB:d=1.2', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  const sil = [...out.matchAll(/silence_duration: ([\d.]+)/g)].reduce((a, m) => a + +m[1], 0);
  return total - sil;
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function attempt(round) {
  const body = {
    contents: [{ parts: [{ text: promptFor(round) }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      // No temperature/topP/topK: Vertex documents that TTS ignores them, and
      // pinning them low is reported to cause one-sentence-then-silence output.
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } }
    }
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  const cand = d?.candidates?.[0];
  const b64 = cand?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error('no audio part (text tokens returned?): ' + JSON.stringify(d).slice(0, 160));
  const pcm = Buffer.from(b64, 'base64');
  const dur = pcm.length / 2 / 24000;
  return { pcm, dur, finish: cand.finishReason };
}

const TARGET = 165, BAND = [152, 178];
const out = path.join(AUDIO, 'full.wav');
const tmp = path.join(AUDIO, '.probe.wav');

console.log(`one take: ${cfg.scenes.length} scenes, ${words} words, target ${TARGET} wpm`);
let best = null;
for (let i = 0; i < MAX_TRIES; i++) {
  const round = best ? Math.min(i, 3) : 0;    // push slower each time it comes back fast
  let t;
  try { t = await attempt(round); }
  catch (e) { console.log(`  take ${i + 1}: ${e.message}`); await new Promise(r => setTimeout(r, 3000)); continue; }

  fs.writeFileSync(tmp, wav(t.pcm));
  const speech = speechSeconds(tmp, t.dur);
  const wpm = words / speech * 60;
  const truncated = t.finish !== 'STOP' || wpm > WPM_FLOOR;
  const miss = Math.abs(wpm - TARGET);
  console.log(`  take ${i + 1}: ${t.dur.toFixed(1)}s total, ${speech.toFixed(1)}s speech, ${wpm.toFixed(0)} wpm, finish=${t.finish}` +
    (truncated ? '  REJECTED (truncated)' : ''));
  if (truncated) { await new Promise(r => setTimeout(r, 3000)); continue; }
  if (!best || miss < best.miss) best = { ...t, wpm, speech, miss };
  if (wpm >= BAND[0] && wpm <= BAND[1]) break;
  await new Promise(r => setTimeout(r, 2000));
}
fs.existsSync(tmp) && fs.unlinkSync(tmp);
if (!best) { console.error(`no usable take after ${MAX_TRIES} attempts`); process.exit(1); }

fs.writeFileSync(out, wav(best.pcm));
console.log(`\nwrote audio/full.wav  ${best.dur.toFixed(1)}s (${(best.dur / 60).toFixed(2)} min), ${best.wpm.toFixed(0)} wpm of speech`);
console.log('next: node scripts/split.mjs');
