# Printing / exporting the Snapshot dashboard . research (no implementation)

**For:** Igor . **Date:** 2026-06-23 . **Scope:** research only, per request. This weighs the ways to get a clean printed / PDF / shareable copy of the Snapshot (numbers, summaries, insights, and their sources). It deliberately stops at a recommendation; nothing is built.

## What we are printing, and why it is not trivial
The dashboard is not an ordinary document, so a naive `Ctrl+P` gives a poor result. The constraints that shape every option:

1. **It is a StatiCrypt-encrypted single-page app.** After the gate decrypts and `document.write`s the page, it is ordinary DOM, so printing itself works; the encryption is not a blocker. But there is no server to render from.
2. **The Story view is animated and shows one "beat" at a time** (only the active beat carries the `.on` class). You cannot print the Story as-is, it would print one slide or a pile of stacked slides. **The Detail view is the printable one** (all content is in the DOM at once), or we author a dedicated print/report layout.
3. **The sources live in a slide-out panel, not inline.** A printout must render each claim's references *inline* (as footnotes / endnotes) with the quote and the record URL spelled out, because paper cannot open a panel or click a link.
4. **There is a WebGL star-field canvas, two themes, and a lot of chrome** (masthead, nav, theme toggle, Story controls). Print must force the light theme and hide the canvas + chrome, or it wastes ink and looks broken.
5. **The data is real and gated.** Whatever we produce is for authorised users; the record links printed as text still require the token to open, which is fine.

## The options

| Option | Fidelity | Effort | Deps | Notes |
|---|---|---|---|---|
| **A. `@media print` stylesheet + a "Save as PDF" button** | High (vector text + SVG) | Low | none | Force light theme, hide canvas/nav/controls, print the **Detail** view with references expanded inline, set page size/margins + page-breaks. Native browser "Save as PDF". Best value for money. |
| **B. Dedicated Report view (Phase D "Report Depth")** | High | Medium | none | A static, linear layout assembled from the same data (snapAgg + narrative + refs): cover, the 6 stakeholder data points, per-phase summary + insights + **references as footnotes**, distribution as static SVG. Printed via the browser. This is essentially what Phase D already scopes. |
| **C. `window.print()` only (no print CSS)** | Low | trivial | none | Prints the Story/Detail as the screen shows it, incl. dark theme + canvas + chrome. Not acceptable for a governance artifact. |
| **D. html2canvas + jsPDF** | Low for text | Medium | 2 libs | Rasterises the DOM to an image then a PDF. Text becomes a blurry, non-selectable bitmap; large files; the star canvas gets captured. **Wrong tool for a text-heavy report.** Avoid. |
| **E. paged.js (Paged Media polyfill)** | Very high | Medium | 1 lib | Proper paginated print from HTML+CSS: running headers, page numbers, controlled breaks, margin boxes. Good if Igor wants a polished, multi-page, numbered PDF without Google Docs. Pairs with B. |
| **F. Headless Puppeteer/Playwright -> PDF** | Very high | High | server/build | Render the page server-side to a pixel-perfect PDF, fully scriptable. Needs a build/cron step and the gated data. Overkill now; the path if report generation is ever automated. |
| **G. Google Doc export (Docs API)** | n/a (editable doc) | Medium | Google Docs API | Assemble the narrative + refs + stats into a branded Google Doc (references as footnotes with the record URLs). Editable, shareable, annotatable by Dave/governors. **This is the Phase D "Google-Doc-exportable" deliverable** and is arguably the best *governance* output (beats a static PDF for review). The workspace already has Google access. |

## Recommendation
Two-track, matching what is already scoped:

1. **Now, cheap and dependency-free: Option A (+ a little of B).** Add a print stylesheet and a "Print / Save as PDF" control on the Snapshot that:
   - forces the **light** theme and hides the star canvas, masthead nav, theme toggle, Story controls, and the floating markers (or renders the markers as footnote numbers);
   - prints the **Detail** view (linear), with each claim's **references expanded inline as footnotes/endnotes** (subject area, date, progress word, the quote, and the **record URL printed as text**, since the live panel cannot print);
   - sets `@page` size + margins, `page-break-inside:avoid` on cards, and `page-break-before` between phase sections.
   This yields an instant, vector-crisp, selectable-text PDF through the browser's own "Save as PDF", with no new libraries and no server.

2. **Phase D, the better governance artifact: Option G (Google Doc export).** For something Dave and the governors can open, annotate, and circulate, the Google Doc export is the stronger path than a static PDF, and it is already the scoped Phase D "Report Depth -> Google Doc with every reference + form links." Build it on the Docs API, mapping each narrative item to a heading/paragraph and each reference to a footnote carrying the `r3-record` URL.

   If a **branded, paginated PDF** is wanted *without* Google Docs, add **paged.js** (Option E) on top of the Report view (B) for page numbers and running headers. Skip html2canvas/jsPDF (D) entirely for this text-heavy report.

## Implementation notes for whoever builds it (so the print path is correct first time)
- **Print the Detail view, never the Story.** Or build the Report view (B) as its own print-only section. The Story's one-beat-at-a-time DOM is not printable.
- **References must be inlined for print.** The slide-out panel does not exist on paper; emit each claim's sources as footnotes/endnotes, with the record link as a visible URL.
- **Force light theme + hide:** the `<canvas class="stars">`, the masthead/nav, `#themeFloat`, the Story play/Present controls, the `.refmk` markers (or convert to footnote superscripts), and the slide-out panel itself.
- **Pagination:** `page-break-inside:avoid` on `.panel`/`.refcard`/insight cards; `page-break-before:always` between Primary, Secondary, Compare.
- **Keep it freeze-safe:** the print path must not depend on any animation having run; render from final state (same rule as the rest of the dashboard).
- **The encrypted page prints fine** once decrypted; no StatiCrypt-specific handling beyond the print CSS.

## How this connects to existing work
- Phase D (already in Focus OS under AIS-Data-Dashboard) is the **"Depth toggle: Simple | Report Depth, Report Depth exportable to a Google Doc with every reference + form links."** Option G is that task; Option B is its on-screen/printable form. The Phase A reference map + the `narrative`/`narrative_ref` Supabase tables (v0.30) already hold exactly the structured content (claims + quotes + record links) a report or Doc needs, so the data layer is done; this is a presentation/export layer on top.
