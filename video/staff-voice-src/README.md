# Staff Voice video · sfp-feedback

A 3m31s narrated explainer of the R3 pipeline and where Steve's two KPIs (session
evaluation, reflection and action plan) fit into it. Built for Steve, Dave and
Hayden. Companion HTML page lives in `../page/`.

Everything on screen is the Observation Dashboard's own CSS, lifted from
`dashboard/src/index.html`, so the video shows the product rather than a mockup.

## Regenerating

```bash
node scripts/tts.mjs      # narration, one wav per scene (skips existing; --force to redo all)
node scripts/fit.mjs      # trim, concat, write timings.json + narration.srt
node scripts/build.mjs    # stamp the timings into index.html
npm run check             # lint + layout + motion + contrast
npm run render            # -> renders/*.mp4
```

`scripts/tts.mjs` reads `GEMINI_API_KEY` from `~/AIS-Data-Dashboard/.env`.

To change a line: edit `scenes.json`, delete that scene's wav, then run tts, fit
and build. **Edit `template/composition.html`, never `index.html`** — the latter is
generated. Scene windows and every animation cue are derived from the narration
track, so a line that gets longer moves its scene and its animation together.

### Pace

The narrator must sound the same in every scene. That means the pace is fixed at
generation time, not afterwards: `tts.mjs` measures each take's words per minute
and re-asks with a nudged direction until it lands near 165, and `fit.mjs` is
capped at +/-3% correction. Stretching a take further than that smears the voice
and it stops sounding like the same person. Do not raise that cap.

## Files

| File | What it is |
|---|---|
| `scenes.json` | The script. One entry per scene, plus the voice and the director's note. |
| `scripts/tts.mjs` | Gemini TTS, `gemini-2.5-flash-preview-tts`, voice Charon, pace-targeted. |
| `scripts/fit.mjs` | Silence trim, +/-3% correction, concat, SRT. |
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
