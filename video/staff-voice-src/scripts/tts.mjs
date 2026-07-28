#!/usr/bin/env node
// Per-scene narration via Gemini TTS. Re-runnable: skips scenes whose wav already exists.
// Key comes from ~/AIS-Data-Dashboard/.env (GEMINI_API_KEY). Never printed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const AUDIO = path.join(ROOT, 'audio');
fs.mkdirSync(AUDIO, { recursive: true });

const envTxt = fs.readFileSync(path.join(os.homedir(), 'AIS-Data-Dashboard/.env'), 'utf8');
const KEY = (envTxt.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error('no GEMINI_API_KEY in ~/AIS-Data-Dashboard/.env'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf8'));
const force = process.argv.includes('--force');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

function wav(pcm) {                                   // 24kHz mono 16-bit PCM -> WAV
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function speak(text, attempt = 1) {
  const body = {
    contents: [{ parts: [{ text: cfg.note + text }] }],
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
      return speak(text, attempt + 1);
    }
    throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`);
  }
  const d = await r.json();
  const b64 = d?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error('no audio in response: ' + JSON.stringify(d).slice(0, 200));
  return Buffer.from(b64, 'base64');
}

const out = [];
for (const s of cfg.scenes) {
  if (only && s.id !== only) { }
  const file = path.join(AUDIO, `${s.id}.wav`);
  const need = force || !fs.existsSync(file) || (only && s.id === only);
  if (need) {
    const pcm = await speak(s.text);
    fs.writeFileSync(file, wav(pcm));
    await new Promise(r => setTimeout(r, 300));
  }
  const bytes = fs.statSync(file).size - 44;
  const dur = bytes / 2 / 24000;
  const words = s.text.split(/\s+/).length;
  out.push({ ...s, file: `audio/${s.id}.wav`, dur: +dur.toFixed(3), wpm: Math.round(words / dur * 60) });
  console.log(`${need ? 'gen ' : 'keep'} ${s.id.padEnd(16)} ${dur.toFixed(2)}s  ${Math.round(words / dur * 60)} wpm`);
}
fs.writeFileSync(path.join(ROOT, 'timings.json'), JSON.stringify(out, null, 2));
const total = out.reduce((a, b) => a + b.dur, 0);
console.log(`\nnarration total ${total.toFixed(1)}s (${(total / 60).toFixed(2)} min) across ${out.length} scenes`);
