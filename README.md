# Crossword Puzzles

Interactive crossword puzzles at [puzzles.ronexler.com](https://puzzles.ronexler.com), hosted on Cloudflare Pages. Each puzzle has a dynamically generated visual theme derived from its topic via the Anthropic API.

---

## Adding a new puzzle — step by step

### Prerequisites

Make sure you have the following before starting:

| Tool | Check | Install |
|------|-------|---------|
| Node.js 18+ | `node --version` | [nodejs.org](https://nodejs.org) |
| Wrangler CLI | `npx wrangler --version` | included via npx |
| Anthropic API key | — | [console.anthropic.com](https://console.anthropic.com) |
| Cloudflare account | — | already configured |
| Git | `git --version` | included on macOS |

Clone the repo if you haven't already:

```bash
git clone https://github.com/RonExler/crosswords.git
cd crosswords
```

---

### Step 1 — Create the puzzle data

Each puzzle is a `crossword.json` file. The easiest way to produce one is to ask Claude with a prompt like:

> "Generate a 21×21 crossword puzzle about [topic]. Return it as JSON matching this schema: [paste the schema below]."

The schema is:

```json
{
  "puzzle": {
    "title": "Puzzle Title",
    "width": 21,
    "height": 21,
    "grid": [
      [ ...row 0: 21 cells... ],
      [ ...row 1: 21 cells... ],
      ...21 rows total...
    ],
    "clues": {
      "across": [
        { "number": 1, "clue": "Clue text here", "word": "ANSWER" }
      ],
      "down": [
        { "number": 1, "clue": "Clue text here", "word": "ANSWER" }
      ]
    }
  }
}
```

**Grid cell format** — every cell in the `grid` array is one of:

```json
null
```
A black (blocked) square.

```json
{ "letter": "A", "number": 1, "isBlack": false }
```
A white square. Fields:
- `letter` — the correct answer letter, uppercase
- `number` — the cell's printed number (only present when this cell starts an across or down word; omit or set `null` otherwise)
- `isBlack` — always `false` for white cells (or omit entirely)

**Minimal example** — a 5×5 grid spelling ONE across and ONE down from cell #1:

```
■ ■ ■ ■ ■
■ O N E ■
■ ■ ■ ■ ■
■ ■ ■ ■ ■
■ ■ ■ ■ ■
```

```json
{
  "puzzle": {
    "title": "Example",
    "width": 5,
    "height": 5,
    "grid": [
      [null, null, null, null, null],
      [null, {"letter":"O","number":1,"isBlack":false}, {"letter":"N","number":null,"isBlack":false}, {"letter":"E","number":null,"isBlack":false}, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null]
    ],
    "clues": {
      "across": [
        { "number": 1, "clue": "Not zero", "word": "ONE" }
      ],
      "down": []
    }
  }
}
```

Standard crossword grids are 15×15 or 21×21 with rotational symmetry. The engine works with any rectangular size.

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

Place your `crossword.json` in the folder:

```
mypuzzle/
├── index.html       ← copied and edited above
└── crossword.json   ← your puzzle data
```

---

### Step 3 — Validate the puzzle data

```bash
node tests/validate.js mypuzzle
```

**What it checks:**
- Every clue number references a real numbered cell in the grid
- Every clue `word` matches the letters the grid traces in that direction from that cell
- No duplicate clue numbers within a direction
- No cells that have a number but no corresponding clue
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

Fix all errors before continuing. Common mistakes:
- Clue number doesn't match any cell's `number` field → check you copied the number correctly from the grid
- Word mismatch → the grid letters don't spell the word you wrote in the clue

---

### Step 4 — Generate the theme

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-theme.js mypuzzle
```

This calls Claude with the puzzle title and full word list and writes `mypuzzle/theme.json`. The theme defines:

- A color palette (background, ink, accents, highlights, grid lines)
- A Google Fonts URL for two typefaces (display + body)
- A one-sentence aesthetic description

Example output:
```
[mypuzzle] Wrote theme.json — Starlit observatory blues with silver-white ink and cosmic-amber accents
```

**Tweaking the theme** — open `mypuzzle/theme.json` and edit any color or font by hand before deploying. All colors are 6-digit hex. Fonts must be available on [Google Fonts](https://fonts.google.com).

If you don't have an API key yet, you can skip this step and write `theme.json` by hand using the format from `mapping/theme.json` as a template. The puzzle will fall back to the default vintage-paper style if `theme.json` is missing.

---

### Step 5 — Add the puzzle to the gallery

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

### Step 6 — Test locally

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

### Step 7 — Commit and push

```bash
git add mypuzzle/ index.html
git commit -m "Add [Puzzle Title] puzzle (No. III)"
git push origin main
```

---

### Step 8 — Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy . --project-name=crosswords --branch=main
```

Wrangler prints a preview URL when done. The live site at `puzzles.ronexler.com` updates within a few seconds.

```
✨ Deployment complete! Take a peek over at https://xxxxxxxx.crosswords-6tb.pages.dev
```

The new puzzle is live at `puzzles.ronexler.com/mypuzzle/`.

---

## Project structure

```
crosswords/
├── index.html              # Gallery page — add new puzzle cards here
├── crossword.css           # Shared styles (CSS variable-driven theming)
├── crossword.js            # CrosswordPuzzle engine
├── theme-loader.js         # Loads theme.json, applies CSS vars, inits puzzle
├── scripts/
│   └── generate-theme.js   # Calls Anthropic API to generate theme.json
├── tests/
│   └── validate.js         # Validates crossword.json before deploy
├── mapping/                # Puzzle No. I
│   ├── index.html
│   ├── crossword.json
│   └── theme.json
└── dogrescue/              # Puzzle No. II
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
