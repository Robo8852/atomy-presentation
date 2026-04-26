# Deck Automation — Options

Notes on automating the "drop a file, get a deck" workflow. Captured for later — not implemented yet.

## What exists today

`scripts/convert_decks.py` and `scripts/build_presentation.py` already convert source PowerPoint files into deck-ready JPGs and write `catalog.json`. Pipeline:

```
.pptx → soffice --headless --convert-to pdf → pdftoppm -jpeg -r 120 → slide-N.jpg
```

Drop `.pptx` files in `downloads/pptx/`, run the script, deck appears at `/decks/<slug>/`. Idempotent.

## Gaps for "drop a PDF and done"

- Script expects `.pptx` input. The PDF→JPG stage is already there (`pdftoppm`), it's just gated behind the PPTX→PDF step.
- `ROOT = Path("/home/owner/Atomy")` in `convert_decks.py` is hardcoded — won't run on a different machine without editing.
- No `npm run add-deck` shortcut — only invokable as `python3 scripts/convert_decks.py`, not discoverable from `package.json`.

## Three options

### Option A — Tiny (~10 min)

Add `scripts/add_deck_from_pdf.py`. Takes one PDF path, slugs the filename, runs `pdftoppm`, writes `manifest.json`, appends to `catalog.json`.

```
python3 scripts/add_deck_from_pdf.py ./Spirulina.pdf
```

Doesn't touch existing scripts. Doesn't fix the hardcoded path (only matters if you re-run the PPTX pipeline).

### Option B — Medium (~30 min)

1. Patch `convert_decks.py` to also walk `downloads/pdf/` and skip the PPTX→PDF step for PDFs.
2. Replace hardcoded `ROOT` with a path derived from the script's own location.
3. Add `"add-deck": "python3 scripts/convert_decks.py"` to `package.json` so it's one command.

```
npm run add-deck
```

Both PPTX and PDF inputs work, runs on any machine, discoverable from `package.json`.

### Option C — Fancy (~1–2 hours)

File watcher (Python `watchdog` or Node `chokidar`) that auto-runs whenever a new PDF lands in `downloads/pdf/`. Optionally point it at a Dropbox/Drive sync folder so dropping a PDF on your phone publishes a deck.

Adds a long-running process. Worth it only if deck-adds happen often enough that running a command feels like friction.

## Recommendation

Start with **B**. Fixes the real gaps (PDF input, hardcoded path, discoverability) without adding a daemon. Upgrade to **C** if deck-adds happen more than once a week.
