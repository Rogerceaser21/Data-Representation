#!/usr/bin/env node
// Inject scene timings into the composition.
//
// timings.json (written by fit.mjs) is the single source of truth for when each
// scene's narration starts. This stamps the scene windows into template/composition.html
// and writes index.html, so adding or re-cutting a line never means hand-editing
// fourteen data-start attributes and sixty animation cues again.
//
// Template contract:
//   {{START:id}} {{DUR:id}}   scene window, seconds
//   {{TOTAL}}                 composition duration
//   {{TIMINGS}}               the timings object, for at(id, offset) in the timeline
// Ids come from timings.json, plus the synthetic silent end card "s14_end".
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'timings.json'), 'utf8'));

const LEAD = 0.55;   // a scene appears this long before its first word
const TAIL = 1.6;    // hold after the last word
const ENDCARD = 8;   // silent text-only end card, held after the tail

// Scene windows: each runs from just before its own line to just before the next.
// Rounded first, then durations from the rounded values, so scenes abut exactly
// and never overlap by a hundredth (the runtime rejects overlapping clips).
const win = {};
const starts = t.scenes.map(s => +Math.max(0, s.start - LEAD).toFixed(2));
const TOTAL_END = +(t.total + TAIL).toFixed(2);
t.scenes.forEach((s, i) => {
  const start = starts[i];
  const end = i + 1 < starts.length ? starts[i + 1] : TOTAL_END;
  win[s.id] = { start, dur: +(end - start).toFixed(2), narr: s.start, narrDur: s.dur };
});
// The end card has no narration line, so its window is synthetic: it takes over
// exactly where the last scene ends and holds for ENDCARD. Registered in `win`
// like a real scene, so the template gets {{START/DUR:s14_end}} and the timeline
// gets at('s14_end', off) with no special case.
win.s14_end = { start: TOTAL_END, dur: ENDCARD, narr: TOTAL_END, narrDur: ENDCARD };
const TOTAL = Math.ceil(t.total + TAIL) + ENDCARD;

let html = fs.readFileSync(path.join(ROOT, 'template/composition.html'), 'utf8');
const missing = [];
html = html.replace(/\{\{(START|DUR):([a-z0-9_]+)\}\}/g, (m, kind, id) => {
  if (!win[id]) { missing.push(id); return m; }
  return kind === 'START' ? win[id].start : win[id].dur;
});
if (missing.length) { console.error('unknown scene id in template:', [...new Set(missing)].join(', ')); process.exit(1); }

// {start, dur} per scene so cues can be absolute (at) or proportional (atf)
const cues = Object.fromEntries(Object.entries(win).map(([k, v]) => [k, { start: v.narr, dur: v.narrDur }]));
html = html.replace('{{TIMINGS}}', JSON.stringify(cues))
  .replace(/\{\{TOTAL\}\}/g, String(TOTAL));

fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log(`index.html written · ${Object.keys(win).length} scenes · ${TOTAL}s`);
for (const [id, v] of Object.entries(win)) {
  console.log(`  ${id.padEnd(16)} ${String(v.start).padStart(6)} -> ${String(+(v.start + v.dur).toFixed(2)).padStart(6)}  (${v.dur}s)`);
}
