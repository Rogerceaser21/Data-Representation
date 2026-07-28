#!/usr/bin/env node
// Per-scene narration via Gemini TTS, paced at generation time.
//
// v2: the pace is fixed by RE-ASKING, not by stretching the audio. Time-stretching
// a take by more than a few percent smears the formants and reads as a different
// narrator (that was the v1 bug). Each line is generated, measured, and if it lands
// outside the target band it is regenerated with a nudged direction, keeping the
// take closest to target. fit.mjs then trims silence and applies at most +/-3%.
//
// Key comes from ~/AIS-Data-Dashboard/.env (GEMINI_API_KEY). Never printed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const AUDIO = path.join(ROOT, 'audio');
fs.mkdirSync(AUDIO, { recursive: true });

const TARGET = 165;         // words per minute
const BAND = [156, 174];    // acceptable without any correction
const MAX_TRIES = 4;

const envTxt = fs.readFileSync(path.join(os.homedir(), 'AIS-Data-Dashboard/.env'), 'utf8');
const KEY = (envTxt.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error('no GEMINI_API_KEY in ~/AIS-Data-Dashboard/.env'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf8'));
const force = process.argv.includes('--force');

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function speak(note, text, attempt = 1) {
  const body = {
    contents: [{ parts: [{ text: note + text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } }
    }
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) {
    const t = await r.text();
    if (attempt < 4 && (r.status === 429 || r.status >= 500)) {
      await new Promise(s => setTimeout(s, 4000 * attempt));
      return speak(note, text, attempt + 1);
    }
    throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`);
  }
  const d = await r.json();
  const b64 = d?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error('no audio: ' + JSON.stringify(d).slice(0, 200));
  return Buffer.from(b64, 'base64');
}

// The direction is nudged, not the audio. Gemini responds to plain pace language.
function noteFor(round) {
  if (round === 0) return cfg.note;
  const slower = 'Slow down. Leave a clear beat at every full stop and comma, unhurried, as if reading to a room. ';
  const faster = 'Keep it moving. Do not linger between sentences. ';
  return cfg.note.replace('Say only the text after the colon:', (round > 0 ? slower : faster) + 'Say only the text after the colon:');
}

const out = [];
for (const s of cfg.scenes) {
  const file = path.join(AUDIO, `${s.id}.wav`);
  const words = s.text.split(/\s+/).length;
  if (!force && fs.existsSync(file)) {
    const dur = (fs.statSync(file).size - 44) / 2 / 24000;
    out.push({ id: s.id, dur, wpm: Math.round(words / dur * 60) });
    console.log(`keep ${s.id.padEnd(16)} ${dur.toFixed(2)}s  ${Math.round(words / dur * 60)} wpm`);
    continue;
  }
  let best = null;
  for (let tryN = 0; tryN < MAX_TRIES; tryN++) {
    // round: 0 = plain note, then push slower or faster depending on the last miss
    const dir = tryN === 0 ? 0 : (best.wpm > TARGET ? 1 : -1);
    const pcm = await speak(noteFor(dir), s.text);
    const dur = pcm.length / 2 / 24000;
    const wpm = words / dur * 60;
    const miss = Math.abs(wpm - TARGET);
    if (!best || miss < best.miss) best = { pcm, dur, wpm, miss, tryN };
    if (wpm >= BAND[0] && wpm <= BAND[1]) break;
    await new Promise(r => setTimeout(r, 400));
  }
  fs.writeFileSync(file, wav(best.pcm));
  out.push({ id: s.id, dur: best.dur, wpm: Math.round(best.wpm) });
  const flag = (best.wpm >= BAND[0] && best.wpm <= BAND[1]) ? 'ok ' : 'OFF';
  console.log(`gen  ${s.id.padEnd(16)} ${best.dur.toFixed(2)}s  ${Math.round(best.wpm)} wpm  ${flag} (take ${best.tryN + 1})`);
}
const total = out.reduce((a, b) => a + b.dur, 0);
const worst = out.reduce((a, b) => Math.abs(b.wpm - TARGET) > Math.abs(a.wpm - TARGET) ? b : a);
console.log(`\n${out.length} scenes, ${total.toFixed(1)}s raw. Furthest from ${TARGET} wpm: ${worst.id} at ${worst.wpm}.`);
