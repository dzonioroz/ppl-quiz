# PPL Question Bank

A local React/Vite practice app built from nine supplied PPL PDF question banks. No account, server, or database is required. Progress is stored in this browser's localStorage.

## Run locally

Install Node.js 20.19+ or 22.12+, then from this folder:

```sh
npm install
npm run dev
```

Open the address printed by Vite (usually http://localhost:5173). To create a static build, run `npm run build`.

## GitHub Pages later

Set Vite's `base` to your repository path (for example `/ppl-quiz/`) in a `vite.config.js` file, run `npm run build`, and publish the `dist` folder. Progress remains specific to each browser/device.

## Data and extraction

Each subject has one JSON file in `src/data/`. The `scripts/extract.py` script reproduces them from the source PDFs when the PDFs are placed in the project `upload/` folder. The report `extraction-report.json` lists question counts and figure references. The original PDF puts the correct response first, so JSON stores `correctAnswer: 0`; the app shuffles choices separately for every quiz. Source page numbers refer to PDF pages. `explanation` is an empty placeholder.

All 61 questions referring to missing figures are included with a `requiresFigure` flag and a visible note in the quiz. Their marked answers remain in the question bank; some may be impossible to solve independently without the figure. This app is a study aid based on supplied material; it does not update or verify aviation rules.
