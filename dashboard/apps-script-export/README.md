# Dashboard Google Doc export (Phase D)

Tiny Apps Script web app behind the Snapshot "Report Depth" -> **Make Google Doc** button.
The dashboard POSTs the live `get_narrative` report model; this builds a formatted Google Doc and
returns its URL. Runs as `admin.user@ais.ae`. No secrets; references never name a teacher.

## Deploy (one time)

1. Create a standalone Apps Script project as **admin.user@ais.ae** (script.google.com -> New project),
   or via clasp: `clasp create --type standalone --title "AIS Dashboard Doc Export"`.
2. Put `Code.gs` + `appsscript.json` in the project (`clasp push --force`, or paste in the editor).
   In the editor, enable "Show appsscript.json" (Project Settings) so the manifest applies.
3. In the editor, run `doGet` once and click through the OAuth consent (Docs + Drive scopes).
   The CLI cannot trigger this consent; it must be done in the browser once.
4. Deploy -> New deployment -> **Web app**: Execute as **Me**, Who has access **Anyone**.
   Copy the `/exec` URL.
5. Put that URL in the dashboard master `dashboard/src/index.html` as `DOC_EXPORT_URL`, then
   re-run `dashboard/encrypt.sh` and ship.

## Redeploy after editing Code.gs

`clasp push --force` then redeploy in place (`clasp redeploy <id>`) so the `/exec` URL stays stable
(same rule as the R3 backend). If a brand-new deployment is made, update `DOC_EXPORT_URL` and re-encrypt.

## Contract

Request: `POST` with `Content-Type: text/plain`, body = JSON:
`{ round, generated_on, scope, method, phases:[{label, scope, strengths, develop}], compare:[...] }`
where each group = `{ evidence, summary, bullets:[], insights:[] }` and each claim =
`{ text, refs:[{ area, date, progress, quote, url }] }`. Built by `buildDocModel()` in the dashboard.

Response: `{ ok:true, url:"<google doc url>" }` or `{ ok:false, error }`.

## Deployed 2026-06-24 (admin.user@ais.ae, via clasp)

- scriptId: `1dUxjLTJAkhhpl4k7NOd0Jxx55sYPTCpuZCONb_UT1L48NCHxJg8777Uc`
- editor: https://script.google.com/d/1dUxjLTJAkhhpl4k7NOd0Jxx55sYPTCpuZCONb_UT1L48NCHxJg8777Uc/edit
- deploymentId: `AKfycbxyU02PN9ZdOzVW45XaiL_4lsvU_FqtDy9f_kEtv7sVuMzVmNQW3Oe2w7TBrvtZtO1j`
- /exec: `https://script.google.com/macros/s/AKfycbxyU02PN9ZdOzVW45XaiL_4lsvU_FqtDy9f_kEtv7sVuMzVmNQW3Oe2w7TBrvtZtO1j/exec`
- Pending: admin.user runs `authorize` in the editor once (grants Docs + Drive), then this URL goes in `DOC_EXPORT_URL` in `dashboard/src/index.html`.

## 2026-06-25 . v3 redesign (redeploy @8)
Doc builder rebuilt to the approved AIS-branded concept: Playfair Display headings + Lato body, AIS navy + gold accent, green/terracotta only on section labels, one consistent bullet style, a navy cover image (Docs API `insertInlineImage` by URL, no UrlFetchApp scope), a stat callout + insight cards (1-cell tables), first tab renamed "Report" (`updateDocumentTabProperties`). `buildSimple` = cards; `buildInDepth` = cover + Contents + sections. References tab + cross-tab links unchanged.
