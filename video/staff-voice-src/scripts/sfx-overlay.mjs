#!/usr/bin/env node
// sfx-overlay.mjs . bake synthesized UI sounds (taps, clicks) into the music bed
// at footage-true times, WITHOUT touching the clean stem.
//
// Graduated from video-v2.5 (2026-08-06), where 7 events shipped this way
// (4 taps + 1 press + 2 clicks). Recipes are verbatim from that build.
//
// Usage:   node scripts/sfx-overlay.mjs            (from the project root)
// Inputs:  sfx-events.json   [{"t": 26.855, "type": "tap"|"click", "gain": -11}]
//                            t in seconds on the FINAL timeline (footage-true:
//                            measure on the rendered footage, not the plan).
//                            gain (dB) optional; defaults tap -11, click -3.5.
//          assets/music-nosfx.mjs? no: assets/music-nosfx.mp3 = the CLEAN
//                            post-duck bed (finish-audio.mjs output). If it does
//                            not exist yet, the current assets/music.mp3 is
//                            promoted to music-nosfx.mp3 first (make sure it is
//                            actually clean; re-run finish-audio.mjs if unsure).
// Output:  assets/music.mp3  = clean stem + all events, 44.1 kHz 192k.
//          assets/sfx/tap.wav, assets/sfx/click.wav (synthesized if missing).
//
// Laws carried from v2.5:
// - Events are overlaid onto the POST-duck bed (duck follows narration; SFX must
//   not pump the ducker), via per-event adelay and ONE amix with normalize=0
//   (amix's default renormalization would drop the bed ~6 dB, the v1.5 trap).
// - Rebakes after a music change: re-run finish-audio.mjs (writes the clean bed),
//   then re-run this script. Never overlay onto an already-overlaid file.
// - Expected result in the mix: event peaks around -18 dB. Verify with
//   measure-mix.mjs or a -ss <t-0.2> -t 0.5 volumedetect region (-ss BEFORE -i).

import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const die = (m) => { console.error('SFX FAIL: ' + m); process.exit(1); };
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

const EVENTS = 'sfx-events.json';
const CLEAN = 'assets/music-nosfx.mp3';
const OUT = 'assets/music.mp3';
const DEFAULT_GAIN = { tap: -11, click: -3.5 };

if (!existsSync(EVENTS)) die(`${EVENTS} not found. One object per event: {"t": seconds, "type": "tap"|"click"}.`);
const events = JSON.parse(readFileSync(EVENTS, 'utf8'));
if (!Array.isArray(events) || events.length === 0) die('sfx-events.json must be a non-empty array');
for (const e of events) {
  if (typeof e.t !== 'number' || e.t < 0) die(`bad t in ${JSON.stringify(e)}`);
  if (e.type !== 'tap' && e.type !== 'click') die(`bad type in ${JSON.stringify(e)} (tap|click)`);
}

if (!existsSync(CLEAN)) {
  if (!existsSync(OUT)) die(`neither ${CLEAN} nor ${OUT} exists; run finish-audio.mjs first`);
  console.log(`NOTE: ${CLEAN} missing, promoting current ${OUT} to the clean stem.`);
  console.log('      If music.mp3 already carried SFX, STOP: re-run finish-audio.mjs first.');
  copyFileSync(OUT, CLEAN);
}

// Synthesize the two source sounds if absent (44.1 kHz mono, exact v2.5 recipes).
mkdirSync('assets/sfx', { recursive: true });
if (!existsSync('assets/sfx/tap.wav')) {
  // Soft fingertip thud: 170 Hz body with fast decay + 1.1 kHz surface tick, 2 ms fade-in.
  ff(['-f', 'lavfi', '-i',
    'aevalsrc=0.55*sin(2*PI*170*t)*exp(-t*38)+0.18*sin(2*PI*1100*t)*exp(-t*70):d=0.14:s=44100',
    '-af', 'afade=t=in:st=0:d=0.002', 'assets/sfx/tap.wav']);
  console.log('synthesized assets/sfx/tap.wav');
}
if (!existsSync('assets/sfx/click.wav')) {
  // Mouse click: band-passed white noise burst (3.5 kHz, exp decay 90) + a 900 Hz tick.
  ff(['-f', 'lavfi', '-i', 'aevalsrc=(2*random(0)-1)*exp(-t*90):d=0.12:s=44100',
    '-f', 'lavfi', '-i', 'aevalsrc=0.5*sin(2*PI*900*t)*exp(-t*90):d=0.12:s=44100',
    '-filter_complex', '[0:a]bandpass=f=3500:w=2500[n];[n][1:a]amix=inputs=2:duration=longest:normalize=0[c]',
    '-map', '[c]', 'assets/sfx/click.wav']);
  console.log('synthesized assets/sfx/click.wav');
}

// One amix: clean bed + every event, each delayed to its footage-true time.
const inputs = ['-i', CLEAN];
const chains = [];
const tags = [];
events.forEach((e, i) => {
  inputs.push('-i', `assets/sfx/${e.type}.wav`);
  const gain = e.gain ?? DEFAULT_GAIN[e.type];
  const ms = Math.round(e.t * 1000);
  chains.push(`[${i + 1}:a]volume=${gain}dB,adelay=${ms}:all=1[e${i}]`);
  tags.push(`[e${i}]`);
});
const fc = `${chains.join(';')};[0:a]${tags.join('')}amix=inputs=${events.length + 1}:duration=first:normalize=0[m]`;
ff([...inputs, '-filter_complex', fc, '-map', '[m]', '-ar', '44100', '-b:a', '192k', OUT]);

console.log(`SFX OK: ${events.length} events baked into ${OUT} (clean stem preserved at ${CLEAN})`);
for (const e of events) console.log(`  ${e.type.padEnd(5)} at ${e.t.toFixed(3)}s gain ${(e.gain ?? DEFAULT_GAIN[e.type])}dB`);
console.log('Verify peaks (~-18 dB in mix): ffmpeg -ss <t-0.2> -i assets/music.mp3 -t 0.5 -af volumedetect -f null -');
