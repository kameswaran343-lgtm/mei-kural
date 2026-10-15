# Kural Saatchi (குறள் சாட்சி)

Kural Saatchi checks Tamil quotations against the canonical Tirukkural corpus. It returns a source-backed match, identifies a misquote, splice, or configured misattribution, or abstains when it cannot establish a match.

## Run

Start the managed `web` and `API Server` workflows in Replit. The app is served at `/`; API endpoints are served below `/api`.

## Verification demo

1. Open **Verify**, choose **Authentic couplet**, and verify Kural 391. The displayed lines are loaded from the corpus API.
2. Choose **One word changed**. Review the `MISQUOTED` verdict and grapheme-level difference against the canonical source.
3. Choose **Unverifiable quote**. Confirm the system abstains and labels nearby couplets as “NOT a match.”
4. Choose **Misattributed line**. Confirm the configured Purananuru attribution is shown instead of a Tirukkural match.
5. Open **Guarded Chat** and compare the selected simulator scenario's raw output with the guarded response. Raw output is explicitly marked unverified.
6. Open **Benchmark Lab** and run the seeded challenge set. The report includes per-class accuracy, a confusion matrix, false-accept and abstention rates, and the naive fuzzy baseline.

## API

- `GET /api/health`
- `POST /api/verify`
- `POST /api/guard`
- `POST /api/chat`
- `POST /api/search`
- `GET /api/kurals`
- `GET /api/kurals/{number}`
- `POST /api/benchmark/run`

The interactive endpoint reference is available at `/docs`.

## Corpus and trust boundary

The checked-in JSON corpus is mapped from [tk120404/thirukkural](https://github.com/tk120404/thirukkural). At server startup, the app validates entry count, contiguous numbering, and both Tamil lines, then computes a SHA-256 hash. If the full corpus is missing or invalid, the server uses only the explicitly identified seed entries and reports demo-corpus status.

The verifier is deterministic. Candidate similarity is used to find likely references, never as proof by itself. Canonical couplet text and corrections come from the loaded corpus; unsupported quotes are not completed or rewritten into plausible-sounding couplets.
