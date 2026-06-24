# Crossword Puzzles

Interactive crossword puzzles at [puzzles.ronexler.com](https://puzzles.ronexler.com), hosted on Cloudflare Pages. Each puzzle has a dynamically generated visual theme derived from its topic.

---

## Adding a new puzzle — step by step

### Prerequisites

| Tool | Check | Install |
|------|-------|---------|
| Node.js 18+ | `node --version` | [nodejs.org](https://nodejs.org) |
| Wrangler CLI | `npx wrangler --version` | included via npx |
| Ingrid | — | crossword construction app used to build puzzles |
| Cloudflare account | — | already configured |
| Git | `git --version` | included on macOS |

Clone the repo if you haven't already:

```bash
git clone https://github.com/RonExler/crosswords.git
cd crosswords
```

---

### Step 1 — Build the puzzle in Ingrid

Create and fill your puzzle grid in Ingrid. When done, export it as a `.jpz` file.

---

### Step 2 — Create the puzzle folder

Pick a short, URL-safe folder name (lowercase, no spaces). Example: `space`, `cooking`, `jazz`.

```bash
mkdir mypuzzle
```

Copy an existing puzzle page as your starting point:

```bash
cp mapping/index.html mypuzzle/index.html
```

Edit `mypuzzle/index.html` — change exactly three things:

1. `<title>` tag
2. `.cw-title` div text
3. `.cw-subtitle` div text

Everything else (script tags, button IDs, layout) stays identical.

---

### Step 3 — Import the .jpz file

```bash
node scripts/import-jpz.js "mypuzzle/My Puzzle.jpz" mypuzzle
```

This writes `mypuzzle/crossword.json` from the Ingrid export. Safe to re-run (overwrites).

Example output:
```
✓ Wrote mypuzzle/crossword.json
  Grid:  15×15
  Title: "My Puzzle"
  Clues: 20 across, 25 down
```

---

### Step 4 — Validate the puzzle data

```bash
node tests/validate.js mypuzzle
```

**What it checks:**
- Valid JSON and required structure (`puzzle`, `grid`, `clues.across`, `clues.down`)
- Every cell letter is a single A–Z character
- No duplicate cell numbers in the grid
- Every clue has a number, clue text, and answer word
- Every clue number references a real numbered cell in the grid
- Every clue `word` matches the letters the grid traces in that direction from that cell
- Every numbered cell is referenced by at least one clue
- No duplicate clue numbers within a direction
- No words shorter than 2 letters

**Example output when all is well:**
```
[mypuzzle] OK
```

**Example output with errors:**
```
[mypuzzle] ERROR: down clue #2 (EXAMPLE): no cell numbered 2 in grid
[mypuzzle] ERROR: across clue #5: word "ANSWER" but grid traces "ANSWR"
```

Fix all errors before continuing.

---

### Step 5 — Generate the theme

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-theme.js mypuzzle
```

This calls Claude with the puzzle title and word list and writes `mypuzzle/theme.json`. The theme defines a color palette, Google Fonts URL, and aesthetic description.

Example output:
```
[mypuzzle] Wrote theme.json — Starlit observatory blues with silver-white ink and cosmic-amber accents
```

**Tweaking the theme** — edit `mypuzzle/theme.json` by hand before deploying. All colors are 6-digit hex. Fonts must be on [Google Fonts](https://fonts.google.com).

You can also skip this step and write `theme.json` by hand using `mapping/theme.json` as a template. The puzzle falls back to the default vintage-paper style if `theme.json` is missing.

---

### Step 6 — Add the puzzle to the gallery

Edit `index.html` at the root of the project. Find the `<div class="puzzle-grid">` block and add a new card:

```html
<a class="puzzle-card" href="/mypuzzle/">
  <div class="puzzle-card-num">No. III</div>
  <h2 class="puzzle-card-title">My Puzzle Title</h2>
  <p class="puzzle-card-theme">One sentence describing the theme</p>
  <span class="puzzle-card-cta">Solve →</span>
</a>
```

Increment the number (`No. III`, `No. IV`, etc.) to match the new puzzle's position.

---

### Step 7 — Test locally

```bash
npx http-server . -p 8765
```

Open [http://localhost:8765/mypuzzle/](http://localhost:8765/mypuzzle/) in your browser and confirm:

- [ ] Grid renders with the correct shape and black cells
- [ ] Clicking a cell highlights a word and shows the clue in the bar above
- [ ] Clue panel lists all Across and Down clues
- [ ] Typing a letter fills in the cell
- [ ] The puzzle's color palette and fonts look distinctly themed
- [ ] Gallery at [http://localhost:8765/](http://localhost:8765/) shows the new card

---

### Step 8 — Commit and push

```bash
git add mypuzzle/ index.html
git commit -m "Add [Puzzle Title] puzzle (No. III)"
git push origin main
```

---

### Step 9 — Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy . --project-name=crosswords --branch=main
```

Wrangler prints a preview URL when done. The live site at `puzzles.ronexler.com` updates within a few seconds.

```
✨ Deployment complete! Take a peek over at https://xxxxxxxx.crosswords-6tb.pages.dev
```

The new puzzle is live at `puzzles.ronexler.com/mypuzzle/`.

---

## Replacing an existing puzzle

To update a puzzle in place (e.g. after revising it in Ingrid):

```bash
node scripts/import-jpz.js "mypuzzle/Updated Title.jpz" mypuzzle
node tests/validate.js mypuzzle
npx wrangler pages deploy . --project-name=crosswords --branch=main
```

No changes to `index.html` or `theme.json` needed unless the title changed.

---

## Restarting a Claude Code session

Open a terminal in the project directory and launch Claude Code:

```bash
cd ~/Projects/crosswords
claude
```

Claude Code automatically loads project memory, so context about this project (puzzle workflow, preferences, past decisions) carries over between sessions. To orient Claude at the start of a session, a prompt like this works well:

> "I want to add a new puzzle / replace the [name] puzzle / work on [specific task]. Here's what I have: ..."

You can also reference this README directly:

> "Read the README and then help me add a new puzzle."

---

## Project structure

```
crosswords/
├── index.html              # Gallery page — add new puzzle cards here
├── crossword.css           # Shared styles (CSS variable-driven theming)
├── crossword.js            # CrosswordPuzzle engine
├── theme-loader.js         # Loads theme.json, applies CSS vars, inits puzzle
├── scripts/
│   ├── import-jpz.js       # Converts Ingrid .jpz export → crossword.json
│   └── generate-theme.js   # Calls Anthropic API to generate theme.json
├── tests/
│   └── validate.js         # Validates crossword.json before deploy
├── mapping/                # Puzzle No. I — Cartography
│   ├── index.html
│   ├── crossword.json
│   └── theme.json
└── dogrescue/              # Puzzle No. II — Dog Rescue
    ├── index.html
    ├── crossword.json
    └── theme.json
```

---

## How theming works

When a puzzle page loads, `theme-loader.js`:

1. Fetches `theme.json` and `crossword.json` simultaneously
2. Overrides the 13 CSS custom properties on `:root` (colors) and `--font-display` / `--font-body` (typefaces)
3. Injects the Google Fonts `<link>` into `<head>`
4. Initialises `CrosswordPuzzle` — by this point all theme values are already in place

If `theme.json` fails to load (missing, malformed JSON, network error), the puzzle loads normally with the default vintage-paper palette from `crossword.css`.

---

## Deployment reference

| What | Value |
|------|-------|
| Platform | Cloudflare Pages |
| Pages project name | `crosswords` |
| Production branch | `main` |
| Live URL | [puzzles.ronexler.com](https://puzzles.ronexler.com) |
| Pages.dev URL | [crosswords-6tb.pages.dev](https://crosswords-6tb.pages.dev) |
| GitHub repo | [github.com/RonExler/crosswords](https://github.com/RonExler/crosswords) |
| Deploy command | `npx wrangler pages deploy . --project-name=crosswords --branch=main` |
