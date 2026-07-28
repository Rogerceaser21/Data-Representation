# Staff Voice video · sfp-feedback

A 3m31s narrated explainer of the R3 pipeline and where Steve's two KPIs (session
evaluation, reflection and action plan) fit into it. Built for Steve, Dave and
Hayden. Companion HTML page lives in `../page/`.

Everything on screen is the Observation Dashboard's own CSS, lifted from
`dashboard/src/index.html`, so the video shows the product rather than a mockup.

## Regenerating

```bash
node scripts/tts.mjs      # narration, one wav per scene (skips existing)
node scripts/fit.mjs      # even out pace, build assets/narration.wav|mp3 + narration.srt
npm run check             # lint + layout + motion + contrast
npm run render            # -> renders/*.mp4
```

`scripts/tts.mjs` reads `GEMINI_API_KEY` from `~/AIS-Data-Dashboard/.env`. To change
a line, edit `scenes.json`, delete that scene's wav, and re-run both scripts. Scene
timings in `index.html` come from `timings.json`, so if a line's length changes the
`data-start` / `data-duration` values and the GSAP cue times need updating to match.

## Files

| File | What it is |
|---|---|
| `scenes.json` | The script. One entry per scene, plus the voice and the director's note. |
| `scripts/tts.mjs` | Gemini TTS, `gemini-2.5-flash-preview-tts`, voice Charon. |
| `scripts/fit.mjs` | Silence trim, pace normalisation to 165 wpm, concat, SRT. |
| `timings.json` | Where each scene lands on the master audio track. Generated. |
| `narration.srt` | Subtitles, supplied separately (not burned in). Generated. |
| `styles/dashboard.css` | Dashboard components, verbatim. Video-only rules are marked. |
| `index.html` | The composition. 13 scenes on one track. |
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
