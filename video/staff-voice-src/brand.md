# Brand config · AIS Observation system

The one file to edit to make a HyperFrames video look like AIS. Values are lifted
from `dashboard/src/index.html` (the live Observation Dashboard), so anything built
against this file is the product, not a lookalike. Change the values here, not in
the composition.

## Colours

Paste these into `:root` of every composition. Light is the default, exactly as the
dashboard ships. `--y` is the one loud accent; everything else stays quiet.

```css
:root[data-theme="light"]{
  --bg:#ece9df;        /* page, warm paper */
  --bg-2:#f4f2ea;      /* raised surfaces, sources drawer */
  --panel:rgba(255,255,255,.66);
  --panel-2:rgba(255,255,255,.86);
  --edge:rgba(20,35,63,.14);
  --edge-soft:rgba(20,35,63,.07);
  --ink:#14233f;       /* AIS navy, all primary text */
  --ink-dim:#3a4a66;
  --ink-mid:#586479;   /* video value; the board ships #6b7790 */
  --ink-faint:#69738a; /* video value; the board ships #99a1b5 */
  --y:#C9890C;         /* the accent. On light backgrounds use #9c6a08 for text */
  --b:#1257FF;         /* "Blue on Star", the AIS approved blue */
  --g:#2ea15a; --r:#D7382B;
}
```

Dark theme exists in the dashboard (`--bg:#060816`, `--ink:#eef1fb`, `--y:#FFBA14`)
but video should stay light unless a scene is a navy cover.

### The SEAS six-point ramp

Never invent judgement colours. Outstanding through Very Weak, in order:

```css
--r1:#0f5f30; --r2:#268a4c; --r3:#6f8f22; --r4:#b8760f; --r5:#d4663a; --r6:#c22f24;
```

(`--r2/--r3/--r4` are darkened from the board's `#2ea15a/#86ab2e/#d68a1a` so white
chip text clears AA when projected. Everything else is the board's own value.)

## Fonts

Two families, loaded from Google Fonts with `display=block` so no serif flash:

- `--display:'Lora',Georgia,serif` — headings, big numbers, judgement words, quotes.
  Italic is the house emphasis: `<em>` inside a heading is italic and `--y`.
- `--body:'Inter',system-ui,sans-serif` — everything else.

Dark theme swaps to Fraunces + Sora. Keep the pairing; don't substitute.

## Scale

Components are drawn for an 1180px column. In a 1920x1080 composition, wrap each
scene's content in `.sbody { width:1150px; zoom:1.62 }` rather than restyling the
components, so every internal proportion stays the dashboard's.

On top of that, lift the board's small classes (anything at 10-13px: card
sub-text, evidence lines, table rows, labels, quotes) by roughly a third. Video is
watched from across a room, often by people who will not lean in. See the
"readability pass" block in `styles/dashboard.css`.

## Card style

Quiet, warm, generous. Panels are `border-radius:18px`, a 1px `--edge` border, a
translucent white fill over the paper background, and a wide soft shadow
(`0 24px 60px -42px var(--shadow)`). No heavy borders, no drop shadows on text,
no gradients except the three-stop kicker stripe (`--y` to `--g` to `--b`) and the
navy cover wash. One accent per screen.

## Motion

Enhancement only. Entrances are short (0.6-1.0s), `power2.out` or `power3.out`,
staggered. The resting state is the final visible state: never animate a viz from
`opacity:0`/`scale:0` in a way that leaves it blank if the animation never runs.
Count-ups are driven from the timeline so a seek is deterministic.

## Voice

Gemini TTS, `gemini-2.5-flash-preview-tts`, voice **Charon**, with a director's note
asking for a measured British accent at 160 wpm.

**Generate the entire script in ONE request, then split the audio locally.** Gemini
re-derives speaker identity on every request, so one request per line produces one
narrator per line. This is a documented, Google-acknowledged, unfixed behaviour with
no determinism control (temperature and top_k/top_p are ignored for TTS). Measured
on the AIS script, per-line generation put neighbouring scenes 2.02 dB apart in
long-term spectrum; a single take with drift EQ puts them 1.08 dB apart, which is
below the 1.6 dB floor that different wording alone produces.

Fix pace by re-asking for the take, never by stretching it: a stretch beyond a few
percent smears the formants, and a *varying* stretch is exactly what makes a voice
seem to change mid-video. One global tempo for one take is safe; per-line tempo is not.

## Never

- Never show a real teacher name. Invented names only.
- Never put a fabricated number on a board component without labelling the panel
  illustrative.
- Never use em dashes or en dashes in on-screen copy.
