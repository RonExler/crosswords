# Enhancements

Ideas and planned improvements for puzzles.ronexler.com. No priority order within sections.

---

## Gameplay

**Auto-save progress**
Store each puzzle's in-progress letters in `localStorage` keyed by puzzle slug. Resume exactly where you left off on return visits. Clear on "Clear All."

**Timer**
Optional stopwatch that starts on first keypress and stops on correct completion. Show final time on the solved screen. Store personal best in `localStorage`.

**Pencil mode**
Toggle between pen (permanent, black letters) and pencil (tentative, grey letters styled differently). Pencil entries are visually distinct and excluded from the Check Answers pass.

**Reveal word**
Extend the current "Reveal Letter" button to also offer "Reveal Word" — fills all cells in the currently selected word at once, marking them revealed (blue tint).

**Check word**
Add a "Check Word" action alongside "Check Answers" — only checks the currently selected word, leaving the rest unmarked. Less revealing than checking the whole grid.

**Rebus / multi-letter cells**
Support cells that accept more than one letter (e.g. NYTXW-style rebus). Requires engine changes to cell sizing and input handling.

**Completion animation**
On a fully correct solve, play a brief visual flourish — e.g. a ripple across the grid cells — before showing the congratulations message.

---

## User experience

**Progress indicator**
Show "12 / 48 words complete" or a percentage bar in the clue bar or header. Update as words are filled in correctly.

**Keyboard shortcut guide**
A `?` button or `Escape` overlay listing all keyboard shortcuts: arrows, Tab (next word), Backspace, etc.

**Print view**
A `@media print` stylesheet that renders the blank grid and clues cleanly on a single page with no UI chrome. Useful for solving on paper.

**Accessibility pass**
- ARIA `role="grid"` and `role="gridcell"` on the puzzle grid
- `aria-label` on each cell with its number and current letter
- Announce the current clue to screen readers via an `aria-live` region when selection changes
- Ensure focus indicators are visible at all zoom levels

**Dark mode**
Add a `prefers-color-scheme: dark` variant to `crossword.css` with inverted-but-themed palettes. Each `theme.json` could include an optional `colorsDark` block.

**Swipe navigation on mobile**
Swipe left/right on the grid area to jump to the next/previous word without tapping the clue panel.

**User comments
Allow short comments about the puzzles, displayed below the puzzle with user initials.

**Difficulty rating (not yet implemented)
Add automated difficulty estimation to the puzzle build pipeline. Since there's no solver history for a brand-new puzzle, use feature-based estimation rather than performance-based rating.
Metrics to calculate (rule-based, no API call needed):
Average and longest answer length
Grid density (white squares ÷ total squares) and black square ratio
Proportion of 3-letter answers
Proportion of answers that are proper nouns or abbreviations
Vocabulary frequency — flag answers that are uncommon in everyday English (use a standard word-frequency list or dictionary check)
Clue style assessment (one Anthropic API call per puzzle, at build time): Send the full clue list and ask the model to rate, on a 1–5 scale: how many clues use straight definitions vs. wordplay/puns/trivia, and an overall "gentleness" rating per the project's own clue guidelines (relatively easy, helpful toward the solver, not deliberately obscure).
Combine into a single score: Weight the rule-based grid/vocabulary metrics and the clue-style score into one overall rating. Map it to a simple label: Easy / Medium / Hard, or a 1–5 scale — match whichever style fits the existing theme.json convention.
Output: Store the result in each puzzle's theme.json (or a new difficulty.json alongside it) so it's computed once at build time, not on every page load. Display the rating on the gallery index page next to each puzzle's title and theme.
Documentation: Update README.md to note that difficulty is computed automatically when a new puzzle is added, as part of the same build step that runs the theme generator.



---

## Puzzle authoring & admin

**Import from .puz / .ipuz**
A converter script (`scripts/import-puz.js`) that reads the standard Across Lite `.puz` binary format or `.ipuz` JSON and outputs `crossword.json`. Enables importing from Crossword Compiler, CrossFire, or other authoring tools.

**~~Import from .jpz~~** ✓ Done — `scripts/import-jpz.js` converts Ingrid exports to `crossword.json`. No dependencies.

**Web-based puzzle editor**
A local dev tool (single HTML file, no server needed) with a click-to-toggle grid builder, clue entry fields, and live validation feedback. Export to `crossword.json`.

**Puzzmo-style structural validation**
Extend `tests/validate.js` with a `--puzzmo` flag that enforces the Puzzmo constructor guidelines: white square count in the 60–110 range, all answers ≥ 3 letters, no unchecked squares, full grid connectivity, ≤ ~15 three-letter words, no duplicate answers or shared roots (ICE / ICE CREAM), and no partial-phrase fills (AT A, IN AT). Runs as part of the standard validation pipeline before theme generation.

**Validate in `package.json` script**
Add `"scripts": { "validate": "node tests/validate.js mapping dogrescue" }` so validation runs with `npm test`. Also run it as a pre-commit hook.

**Theme preview / regeneration**
Add a `--preview` flag to `generate-theme.js` that prints the color palette to the terminal as colored blocks (using ANSI escape codes) so you can evaluate a theme before writing the file.

**Author notes
Add section adjacent to or as popup for notes from the author about the puzzle.

**Puzzle image
Add ability for admin to insert an image on the puzzle page entry block. That image also shows on the puzzle page. Image can be entered initially or later.

---

## Technical infrastructure

**GitHub Actions CI/CD**
On every push to `main`:
1. Run `node tests/validate.js` on all puzzle directories
2. If all pass, run `npx wrangler pages deploy` automatically

Eliminates the manual deploy step and catches data errors before they go live.

**Auto-discover puzzle directories**
Instead of hardcoding puzzle names in `tests/validate.js`, scan for all subdirectories that contain a `crossword.json`. New puzzles are validated automatically without editing the test command.

**PWA / offline support**
Add a `manifest.json` and a service worker that caches `crossword.js`, `crossword.css`, `theme-loader.js`, and the active puzzle's assets. The puzzle remains playable with no network connection after first load.

**Puzzle versioning**
Add a `"version"` field to `crossword.json` so published corrections (clue rewording, grid fixes) can be tracked. On load, if the stored `localStorage` version doesn't match the JSON version, prompt the user before overwriting their progress.

**Structured `package.json`**
Add a `package.json` with `scripts` for `validate`, `generate-theme`, `serve`, and `deploy`. Reduces the commands an admin needs to remember to `npm run deploy`.

---

## Theme & design

**Theme palette preview in gallery cards**
Show a small row of color swatches (paper, ink, accent) on each gallery card, drawn from that puzzle's `theme.json`. Gives a visual preview of the puzzle's aesthetic before clicking in.

**Theme color editor**
An in-browser panel (dev-only, toggled by a URL param like `?edit-theme`) that renders live sliders/pickers for each CSS variable so you can tune a theme visually before writing back to `theme.json`.

**Animated theme transition**
When the theme loads (async, after initial paint), CSS-transition the color properties over ~300ms instead of snapping. Eliminates the brief flash of default styles on slow connections.

**Multiple theme variants per puzzle**
Support `theme-light.json` and `theme-dark.json`, selected automatically by `prefers-color-scheme` or a manual toggle button.

---

## Content & publishing

**Constructor byline**
Add an optional `"author"` field to `crossword.json`. Display it in the puzzle header as "Constructed by ___".

**Puzzle notes**
Add an optional `"notes"` field — a short paragraph from the constructor about the theme or a hidden feature. Show it in a collapsible section below the clue panel.

**Series / tagging**
Group puzzles into named series (e.g. "Science", "Pop Culture"). Add tags to each puzzle card in the gallery and a filter bar to show only puzzles matching a tag.

**RSS feed**
Auto-generate a `feed.xml` at deploy time listing all puzzles with their title, theme description, and publish date. Lets people subscribe to new puzzle releases.

**Shareable solved state**
On completion, offer a "Share" button that copies a URL encoding the solve time and puzzle slug. The recipient sees a "Ron solved this in 14:32" splash before starting their own solve.

**Embed widget**
A small `<iframe>`-compatible standalone build of the puzzle engine so a puzzle can be embedded in any external page or newsletter.
