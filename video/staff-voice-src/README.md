# Staff Voice video · sfp-feedback

A three-minute narrated explainer of the R3 pipeline and where Steve's two KPIs
(session evaluation, reflection and action plan) fit into it. Built for Steve,
Dave and Hayden. Companion HTML page lives in `../staff-voice/`. v1.3 cut the
v1.2 4m00s edition to 3m00s: tighter wording (611 -> 552 words, every scene,
number and claim kept), trimmed intra-scene pauses, and one modest global tempo.

Everything on screen is the Observation Dashboard's own CSS, lifted from
`dashboard/src/index.html`, so the video shows the product rather than a mockup.

## Regenerating

```bash
node scripts/tts-single.mjs      # the WHOLE script in one request -> audio/full.wav
node scripts/split.mjs           # cut into scenes, ONE global tempo, timings.json + srt
python3 scripts/tighten.py       # shrink intra-scene pauses, recompute timings + srt
python3 scripts/deflutter.py     # flatten the take's slow timbre drift. Run ONCE per recut
python3 scripts/voiceconsist.py  # PROVE the voice is consistent before accepting the take
node scripts/build.mjs           # stamp the timings into index.html
npm run check                    # lint + layout + motion + contrast
npm run render                   # -> renders/*.mp4
```

`tts-single.mjs` reads `GEMINI_API_KEY` from `~/AIS-Data-Dashboard/.env`.

**Takes vary; score before accepting.** One request removes per-line drift, but
individual takes still differ in how much the voice wanders across the length of
the take. Building v1.3 the first take measured 3.6 dB between two adjacent
scenes even after drift EQ (audibly a register shift) and was discarded; the next
one measured 1.1 dB and shipped. If `voiceconsist.py` reports an adjacent max
much above the phonetic floor, regenerate the take rather than shipping it.

To change a line: edit `scenes.json`, then run all the scripts above. **Edit
`template/composition.html`, never `index.html`** — the latter is generated. Scene
windows and every animation cue are derived from the narration track, so a line
that gets longer moves its scene and its animation with it.

### Why one request, and never one per scene

Gemini emits audio autoregressively with the speaker identity as soft in-context
conditioning, **re-derived on every request**. Generating a line at a time gives a
different performance each time, even with an identical voice and an identical
prompt, and the result sounds like two narrators taking turns. Google documents the
symptom, documents no determinism control (Vertex *ignores* temperature/top_k/top_p),
and staff acknowledged it on their forum in Sept 2025 and June 2026 without a fix.

Measured on this script, comparing each scene's long-term spectrum. The "phonetic
floor" is how much the same take differs from itself on different words, 1.6 dB:

| | adjacent scenes | far-apart scenes |
|---|---|---|
| one request per scene | 2.02 dB (random jumps) | 1.95 dB |
| one request, split | 1.32 dB | 2.97 dB (slow drift) |
| one request, split, drift EQ | **1.08 dB** | 2.66 dB |

Neighbouring scenes now differ *less than the same voice differs from itself*.
What remains is a slow gradient from open to close, which the ear tracks far less
than a jump. `deflutter.py` reduces it by EQ-matching each scene to the take's
average colour; that is linear filtering, so it changes tone and never timing.

**Do not go back to per-line generation, and do not time-stretch by more than a few
percent.** Both reintroduce the two-narrators effect. Pace is set by re-asking for
the take (`tts-single.mjs` measures wpm and pushes the direction slower), and
`split.mjs` applies at most one global tempo to the whole take.

## Files

| File | What it is |
|---|---|
| `scenes.json` | The script. One entry per scene, plus the voice and the director's note. |
| `scripts/tts-single.mjs` | Gemini TTS, one request for the whole script, pace-targeted retries. |
| `scripts/split.mjs` | Cuts the take into scenes, ONE global tempo, timings.json + SRT. |
| `scripts/tighten.py` | Shrinks intra-scene pauses (silence-only cuts), recomputes timings + SRT. |
| `scripts/deflutter.py` | EQ-matches each scene to the take's average colour. Run once per recut. |
| `scripts/voiceconsist.py` | Measures scene-to-scene voice consistency; run before accepting a take. |
| `scripts/build.mjs` | Stamps `timings.json` into the template to produce `index.html`. |
| `template/composition.html` | **The composition you edit.** 14 scenes on one track. |
| `index.html` | Generated. Do not edit. |
| `timings.json` | Where each scene lands on the master audio track. Generated. |
| `narration.srt` | Subtitles, supplied separately (not burned in). Generated. |
| `styles/dashboard.css` | Dashboard components, verbatim. Video-only rules are marked. |
| `brand.md` | The AIS look, for any future HyperFrames video. Edit this, not compositions. |

## Numbers on screen

The June round figures (110 lessons, 104 teachers, 3.22 average progress, and the
six-point distribution) were computed by running the dashboard's own `snapAgg()`
against the live baked snapshot, not retyped from a document. They match the board
by construction. Anything that cannot be sourced that way is labelled illustrative
on screen.

## Known deliberate choices

- Muted ink tokens and three ramp colours are darkened slightly versus the board,
  so small text and white-on-chip text clear WCAG AA when projected. Video only.
- Teacher names are invented. The sources drawer footer states that references never
  name a teacher, which is the dashboard's real behaviour.
- Scenes 7 to 11 describe work that is proposed, not built. Those panels carry a
  "proposed" or "illustrative" label on screen.
