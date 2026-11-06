# Question figures

Figures appear below the question and in answer review. The letter labels stay
the same when answer choices shuffle. The full-size image opens in another tab.
Unresolved figures retain a notice; no substitute chart values are invented.

## PPL Kom-1

The original image was extracted without redrawing or relabelling from page 23 of
the Serbian CAA's Communications paper:
https://www.cad.gov.rs/upload/letacko/knjige/ppl/komunikacije.pdf
(2010 PDF, retrieved 6 November 2026).

`pdfimages -f 23 -l 23 -png` extracts the original 800 × 467 image. It is stored
locally at `src/assets/figures/ppl-kom-1.png`; no third-party image request is
made during a quiz. The linked source is an older paper, not confirmation of
which figures will appear in a current examination.

Checked visually against the six current question keys: A apron, B holding
point, C line-up, E downwind, F base, G final. D is on the crosswind side.
This restores COMMUNICATION-088, 089, 090, 110, 135 and 137.

`src/reference/question-figures.json` holds the explicit subject/question mapping,
source attribution and verified text description. The description goes into the
server's generated question bank so the AI tutor can discuss the recovered
figure without receiving images. It is included in the explanation cache hash.
Missing figures still receive the tutor's missing-figure response. Regenerate
with `npm run ai:bank` after changes and redeploy the AI function alongside them.

The importer now detects “Fig.” as well as “figure”. Existing missed flags have
been corrected; these flags describe a question's dependency even when a figure
is available. Adding more figures requires checking their labels and values
against the specific questions, then adding the asset and mapping.

## Other CAA subjects audited

The directory URL returns HTTP 500, so discovery used the CAA Airplane Pilots
exam page and indexed older PDF links. The currently linked 2022 Serbian papers
were downloaded for Air Law, Aircraft General Knowledge, Flight Performance,
Human Performance, Meteorology, Operational Procedures and Principles of Flight;
they omit the appendices. The current Navigation link points to a file named
`.pdf`; the older `Navigacija.pdf` contains the missing charts.

The older papers contain usable appendices. All included images were visually
inspected. Figure IDs and callouts were matched to the questions; inclusion does
not certify every stored answer. Original labels, language, chart dates, units
and source-resolution limits are retained. Every image has a source PDF/page link.
For Nav-4, the complete appendix page was rendered at 1800 pixels because the
source chart is embedded as fifteen separate image strips.

| Subject | Figure questions with images | Still unresolved |
| --- | ---: | ---: |
| Aircraft General Knowledge | 1 | 0 |
| Communication | 6 | 0 |
| Flight Performance and Planning | 22 | 14 |
| Meteorology | 7 | 1 |
| Navigation | 41 | 0 |
| Operational Procedures | 18 | 0 |
| Principles of Flight | 8 | 0 |
| Air Law | 0 | 0 |
| Human Performance | 0 | 0 |

There are 30 figures serving 103 questions. Air Law and Human Performance have no
explicit figure dependencies in the current bank and no older appendix was found.
`question-figure-audit.json` lists exact coverage and unresolved question IDs.

### Source PDFs

All paths below are relative to `https://cad.gov.rs/upload/letacko/knjige/ppl/`:

- Aircraft General Knowledge: `poznavanje%20vazduhoplova.pdf`, page 24 (AKG-2).
- Flight Performance: `performanse%20leta%20i%20planiranje.pdf`, pages 26–29.
- Meteorology: `meteorologija.pdf`, pages 27–29.
- Navigation: `Navigacija.pdf`, pages 24–30.
- Operational Procedures: `operativne%20procedure.pdf`, pages 23–25.
- Principles of Flight: `principi%20leta.pdf`, page 24.
- Air Law checked: `vazduhoplovni%20propisi.pdf` (25 pages).
- Human Performance checked: `ljudske%20mogucnosti%20i%20ogranicenja.pdf` (22 pages).

### Unresolved variants and source issues

- FPP-15e (takeoff) and FPP-16e (landing): the older Serbian counterparts have
  different table data or incomplete weight coverage. They have deliberately
  not been attached to the eleven takeoff/landing questions; they would not
  reliably support the supplied numerical answers.
- FPP-17F/G/H: the appendix provides a generic loading graph/envelope, but none
  of these three scenario variants or their required input data. The extracted
  question text also lacks those data. They remain unresolved.
- Meteo-14: not present in the older appendix. METEOROLOGY-148 remains unresolved.
- Meteo-2: the historical chart is attached, but does not clearly substantiate
  METEOROLOGY-144's answer at the stated position. A per-question notice flags it.
- OP-1: OPERATIONAL-PROCEDURES-115 asks about A/B while its correct answer
  describes A/E. A notice flags the discrepancy; the answer key is preserved.
- OP-4 is monochrome in the original appendix. A note asks readers to use the
  colours stated in the question; no colours were fabricated.
- FPP figures with an `e` suffix use the recovered Serbian-language counterpart
  with a visible notice. English chart variants have not been independently found.

For charts without a verified text interpretation, the AI tutor explicitly says
it cannot independently verify the answer from the displayed image. A recovered
image alone does not bypass this safeguard. Verified text contexts are currently
provided for Kom-1, AKG-2, PoF-1/2, OP-1/2/3/4 and Meteo-4/6/15. Source context
and availability both participate in the AI cache hash.
