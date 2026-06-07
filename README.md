# Crossword Puzzles

Interactive crossword puzzles deployed to [puzzles.ronexler.com](https://puzzles.ronexler.com) via Cloudflare Pages.

Each puzzle has a dynamically generated visual theme derived from its topic using the Anthropic API.

---

## Adding a new puzzle

### 1. Create the puzzle subfolder

```
puzzles/
└── mypuzzle/
    ├── index.html
    └── crossword.json
```

Copy `mapping/index.html` as your starting point — it already wires up the theme loader and button handlers. Change only the `<title>`, `.cw-title`, and `.cw-subtitle` text.

### 2. Write `crossword.json`

The format mirrors the existing puzzles:

```json
{
  "puzzle": {
    "title": "My Puzzle Title",
    "width": 21,
    "height": 21,
    "grid": [ ... ],
    "clues": {
      "across": [
        { "number": 1, "clue": "Clue text", "word": "ANSWER" },
        ...
      ],
      "down": [
        { "number": 1, "clue": "Clue text", "word": "ANSWER" },
        ...
      ]
    }
  }
}
```

**Grid cells** are either `null` (black) or an object:

```json
{ "letter": "A", "number": 1, "isBlack": false }
```

`number` is only present on cells that start an across or down word. `isBlack: true` renders as a solid black cell (equivalent to `null`).

### 3. Validate the puzzle data

```bash
node tests/validate.js mypuzzle
```

This catches common authoring errors:
- Clue number has no matching numbered cell in the grid
- Clue `word` doesn't match what the grid traces for that number and direction
- Duplicate clue numbers
- Words shorter than 2 letters

Fix any errors before continuing.

### 4. Generate the theme

```bash
ANTHROPIC_API_KEY=sk-... node scripts/generate-theme.js mypuzzle
```

This calls `claude-opus-4-8` with the puzzle title and word list and writes `mypuzzle/theme.json`. The theme includes:

| Field | Description |
|-------|-------------|
| `description` | One-sentence aesthetic description |
| `googleFontsUrl` | Google Fonts CSS2 URL for display + body fonts |
| `colors.paper` | Page background |
| `colors.ink` | Primary text + black cells |
| `colors.accent` / `accentLight` | Active clue border, toggle button |
| `colors.hlWord` / `hlCell` | Word highlight / selected cell |
| `colors.border` | Grid lines |
| `fonts.display` / `body` | CSS font-family strings |

You can hand-edit `theme.json` to adjust any values before deploying.

### 5. Add the puzzle to the gallery

Edit `index.html` at the project root and add a new `<a class="puzzle-card">` entry:

```html
<a class="puzzle-card" href="/mypuzzle/">
  <div class="puzzle-card-num">No. III</div>
  <h2 class="puzzle-card-title">My Puzzle Title</h2>
  <p class="puzzle-card-theme">Brief description of the theme</p>
  <span class="puzzle-card-cta">Solve →</span>
</a>
```

### 6. Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy . --project-name=crosswords --branch=main
```

The new puzzle is live at `puzzles.ronexler.com/mypuzzle/`.

---

## Project structure

```
crosswords/
├── index.html            # Gallery page
├── crossword.css         # Shared styles (CSS variable-driven)
├── crossword.js          # CrosswordPuzzle engine
├── theme-loader.js       # Theme fetch + CSS variable application
├── scripts/
│   └── generate-theme.js # Anthropic API theme generator
├── tests/
│   └── validate.js       # Puzzle data validator
├── mapping/
│   ├── index.html
│   ├── crossword.json
│   └── theme.json        # Generated theme
└── dogrescue/
    ├── index.html
    ├── crossword.json
    └── theme.json        # Generated theme
```

## How theming works

Each puzzle page:
1. Fetches `theme.json` and `crossword.json` in parallel on load
2. Applies theme colors as CSS custom properties on `:root`, overriding the defaults in `crossword.css`
3. Injects the theme's Google Fonts `<link>` into `<head>`, overriding `--font-display` and `--font-body`
4. Initialises the puzzle with the now-themed styles already in place

If `theme.json` is missing or malformed, the puzzle falls back to the default vintage-paper aesthetic from `crossword.css`.

## Running locally

```bash
npx http-server . -p 8765
# open http://localhost:8765
```

## Deployment target

- **Platform:** Cloudflare Pages
- **Project:** `crosswords` (Pages project name)
- **Live URL:** [puzzles.ronexler.com](https://puzzles.ronexler.com)
- **Pages.dev URL:** [crosswords-6tb.pages.dev](https://crosswords-6tb.pages.dev)
