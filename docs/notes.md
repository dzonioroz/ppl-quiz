# Notes library

The authenticated app has a Notes navigation entry with Documents, Question Papers, Airfields, and
Lesson Notes. Lesson Notes is an empty state for a later scan/transcription workflow;
this change does not enable personal uploads or persist private notes.

## Original question papers

Question Papers contains all nine supplied source PDFs from `~/Downloads/PPL`,
unchanged, with corrected subject names for display. They live in
`src/assets/documents/question-papers/` and use the same PDF viewer, downloads,
and device cache as other references. Together they add approximately 1.85 MB;
each file loads only when opened. These are shared static assets, like the
existing references.

## Included references

- 1978 Cessna 172N POH: supplied 73-page scan (1,610,984 bytes). Chapter links
  refer to PDF pages, not the printed handbook page numbers. The scan ends on the
  section 8 contents page; the rest of section 8 and section 9 are absent.
- C172M / YU-DOY normal checklist: supplied two-page PDF, plus 16 HTML procedure
  sections checked against rendered source pages. Flight-phase order follows the
  source's columns. Conditional instructions and magneto limits remain explicit.
- C172 / YU-DOY emergency checklist: eight HTML procedure sections checked against
  photos IMG_6699 and IMG_6700. Source JPEGs are resized copies; original HEICs are
  retained outside the repository. Photo downloads shrink from approximately
  3.6 MB to 1.45 MB combined. Sources load only when requested.
- LYNS aerodrome chart: 3 September 2026, AIRAC AMDT 8/26.
- LYNS visual operation chart: 30 October 2025, AIRAC AMDT 5/25.
- LYZR aerodrome and visual operation charts: 30 October 2025, AIRAC AMDT 5/25.

These are the supplied editions, with no live AIP/NOTAM synchronization. Do not
merge C172N handbook applicability with C172M/YU-DOY checklist applicability.
Transcriptions adjust typography/spacing and heading capitalization; procedural
wording is retained, including unusual source wording. HTML checklists omit the
repeated end-of-section “checklist completed” labels. This library is a study reference.

## Viewer and storage

PDF.js and its worker are self-hosted by Vite and loaded only when a PDF is opened.
The Vite resource plugin also emits versioned decoders, character maps, and standard
fonts from the installed package. The POH requires the JBIG2 decoder; omitting it
can produce a blank canvas without a rejected render promise.
The viewer renders one page at a time with navigation, chapter shortcuts, zoom,
rotation, fullscreen where supported, and original/download fallbacks. PDFs stay
as PDFs to preserve charts, tables, and the original scan. No external viewer or
third-party document service receives the files. No OCR/text search is added to
the scanned handbook.

On first opening, the full PDF is fetched (the largest is only 1.61 MB). Successful
responses are stored in Cache Storage under `ppl-reference-documents-v1`. Reopening
uses cached bytes before a network request. Storage errors do not prevent viewing.
Vite emits content-hashed asset URLs, so a replacement file receives a new cache
key. Cache storage is best effort and can be evicted; this is not a full offline app.
GitHub Pages controls its own HTTP cache headers, so repeat-view caching does not
rely on configuring custom headers there.

Reference files are **shared static assets**, publicly retrievable by URL on GitHub
Pages even though the app UI is behind sign-in. Never place personal lesson scans
in this asset directory. Private notes should later use authenticated Supabase
storage with account-based access policies and a separate data model; they must
not enter the shared document cache.

## Updating content

`src/documentLibrary.js` defines titles, edition dates, aircraft labels, assets, and
chapter shortcuts. PDFs/JPEGs live in `src/assets/documents/`. Checklist content is
in `src/reference/checklists.json`; each procedure points to its source PDF page
or source photo. Update both source and transcription together and visually verify
all procedure steps, values, and conditional branches. Keep the reference JSON
outside `src/data/`, which is reserved for the nine question banks.

## Validation

`npm test` covers checklist search/navigation, condition visibility, edition labels,
empty lesson state, cache reuse and storage failure, plus existing quiz/auth/cloud
regressions. `npm run build` includes the worker and all reference assets at the
configured `/ppl-quiz/` base path.

Manual Chromium verification rendered all six PDFs, checked handbook chapter/zoom/rotation
controls and nonblank image pixels, confirmed reopening avoids another PDF download,
and checked the emergency checklist at a 390-pixel viewport without horizontal page overflow.
One optional live Supabase security integration test skips without its environment configuration.
