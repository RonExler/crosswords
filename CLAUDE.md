# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Interactive crossword puzzles at [puzzles.ronexler.com](https://puzzles.ronexler.com), served as static files from Cloudflare Pages. Each puzzle lives in its own directory and gets a visual theme derived from its topic.

There is no `package.json`, no build step, and no npm dependencies. Everything is plain HTML/CSS/JS plus a few standalone Node scripts (Node 18+, native `fetch`).

## Commands

```bash
node scripts/import-jpz.js "mypuzzle/My Puzzle.jpz" mypuzzle   # Ingrid .jpz → crossword.json
node tests/validate.js mypuzzle                                # validate one puzzle
node tests/validate.js                                         # validate the default list (see gotcha below)
ANTHROPIC_API_KEY=sk-... node scripts/generate-theme.js mypuzzle  # write theme.json via Claude
npx http-server . -p 8765                                      # local preview
npx wrangler pages deploy . --project-name=crosswords --branch=main
```

`validate.js` exits 1 on any error — run it before every deploy. `import-jpz.js` overwrites `crossword.json` and is safe to re-run.

`README.md` holds the full step-by-step runbook for adding a puzzle; don't duplicate it here.

## Architecture

A puzzle page is three static assets plus two JSON files:

```
mypuzzle/index.html  →  ../crossword.js     (CrosswordPuzzle engine)
                     →  ../theme-loader.js  (initPuzzle bootstrap)
                     →  mypuzzle/theme.json + mypuzzle/crossword.json (fetched at runtime)
```

`theme-loader.js` is the seam that keeps puzzles identical in code but distinct in appearance. `initPuzzle(appId, btnIds)`:

1. Fetches `theme.json` and `crossword.json` in parallel via `Promise.allSettled`
2. Applies the theme by setting 13 CSS custom properties on `:root` (plus `--font-display` / `--font-body`) and injecting a Google Fonts `<link>`
3. Constructs `CrosswordPuzzle` and wires the four control buttons

Theme failure is non-fatal — a missing or malformed `theme.json` falls back to the default vintage-paper palette in `crossword.css`. Puzzle-data failure renders an error message into `.cw-grid-container` instead. Theme values are applied *before* the engine constructs, so the engine never needs to know about theming.

`crossword.js` is a single `CrosswordPuzzle` class holding all state (grid, current cell, direction, word map). It builds a word list by tracing from each numbered cell, renders grid and clue lists, and owns keyboard nav, highlight sync, and the check/reveal/clear actions. Public methods are only `checkAnswers()`, `revealLetter()`, `clearAll()`, `revealAll()` — everything else is `_`-prefixed internal.

`theme.json` color keys are *not* the CSS variable names — `accent` → `--gold`, `accentLight` → `--gold-light`. The mapping lives in `applyTheme()` in `theme-loader.js`; adding a themeable color means editing that map and `crossword.css` together.

`crossword.json` shape: `{ puzzle: { title, width, height, grid, clues } }`. `grid` is a row-major array where a black square is `null` and a cell is `{ letter, number, isBlack }` (`number` is `null` for unnumbered cells). Clues are `{ number, clue, word }` under `clues.across` / `clues.down`. `validate.js` enforces the cross-checks that matter: every clue number resolves to a real numbered cell, and every clue's `word` matches the letters the grid actually traces in that direction.

## Conventions and gotchas

**New puzzle pages are copies.** Copy `mapping/index.html` and change exactly three things: `<title>`, `.cw-title`, `.cw-subtitle`. Script tags, button IDs, and layout must stay identical — `initPuzzle` depends on those IDs.

**`tests/validate.js` has a hardcoded default list.** `DEFAULT_PUZZLES = ['mapping', 'dogrescue']` at the top. Adding a puzzle without updating it means the no-arg run silently skips the new puzzle.

**Gallery cards use integers, not Roman numerals.** `index.html` uses `<div class="puzzle-card-num">1</div>`. The same integer opens the puzzle page's `.cw-subtitle` (`"1 — Charts, coordinates…"`).

**`scripts/generate-theme.js` runs `claude-opus-5` with thinking on.** Thinking tokens count toward `max_tokens`, and the response's first content block is a thinking block — the script selects the `text` block rather than indexing `content[0]`. Preserve both if you touch the request.

**Themes must stay visually distinct *across* puzzles — the generator can't know this.** It sees one puzzle's title and word list, nothing else, so it happily proposes a warm-parchment palette for a cartography puzzle that then looks just like `dogrescue`'s terracotta. `a5b4339` moved `mapping` off parchment to slate-blue for exactly this reason, and a regenerated theme reintroduced the clash in `622fea3` (reverted in `49541fe`). Before accepting generated output, compare `paper` / `ink` / `accent` against every other puzzle's `theme.json` and look at the gallery page, not just the puzzle page in isolation.

**Regenerating a theme overwrites a hand-vetted design decision.** `theme.json` is committed, so a run is recoverable via git — but treat overwriting an existing theme as a design change needing review, not as a way to smoke-test the script. Point it at a scratch puzzle dir if you only want to verify the script works.

**Deploys are manual.** Pushing to GitHub does not deploy; the `wrangler pages deploy` command above does. Pages project is `crosswords`, production branch `main`.

**Source `.jpz` / `.tsv` files are untracked.** Ingrid exports live alongside the puzzle but aren't committed.

`ENHANCEMENTS.md` is a backlog of planned features — check it before proposing new gameplay ideas.
