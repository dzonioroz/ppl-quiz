# PPL Question Bank

A local React/Vite practice app built from nine supplied PPL PDF question banks. No account, server, or database is required. Progress is stored in this browser's localStorage.

## Run locally

Install Node.js 20.19+ or 22.12+, then from this folder:

```sh
npm install
npm run dev
```

Open the address printed by Vite (usually http://localhost:5173). To create a static build, run `npm run build`.

## GitHub Pages

Vite is configured for `/ppl-quiz/`. In the GitHub repository, select **Settings → Pages → Build and deployment → Source → GitHub Actions**. The deployment workflow builds and publishes `dist` on every push to `main`, or can be started manually from the Actions tab.

The published site is https://dzonioroz.github.io/ppl-quiz/. Progress remains specific to each browser/device.

## Shared password

Set the shared password in `src/access-config.js`. When changing it, also change `version` (for example, from `'1'` to `'2'`) to require sign-in again after deployment. Commit and push the change to deploy it.

Successful sign-in is remembered in this browser. **Sign out** locks the app without deleting quiz progress. This is a casual gate for friends and family: the password and question data are included in the downloadable site, so it does not protect private information.

## Data and extraction

Each subject has one JSON file in `src/data/`. The `scripts/extract.py` script reproduces them from the source PDFs when the PDFs are placed in the project `upload/` folder. The report `extraction-report.json` lists question counts and figure references. The original PDF puts the correct response first, so JSON stores `correctAnswer: 0`; the app shuffles choices separately for every quiz. Source page numbers refer to PDF pages. `explanation` is an empty placeholder.

All 61 questions referring to missing figures are included with a `requiresFigure` flag and a visible note in the quiz. Their marked answers remain in the question bank; some may be impossible to solve independently without the figure. This app is a study aid based on supplied material; it does not update or verify aviation rules.
