#!/usr/bin/env node
/**
 * Generates a visual theme for a crossword puzzle by calling the Anthropic API.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-theme.js <puzzleDir> [puzzleDir...]
 *
 * Example:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-theme.js mapping dogrescue
 *
 * Writes theme.json into each puzzle directory.
 * Requires Node 18+ (uses native fetch).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
  console.error('Usage: ANTHROPIC_API_KEY=sk-... node scripts/generate-theme.js <puzzleDir>');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: node scripts/generate-theme.js <puzzleDir> [puzzleDir...]');
  process.exit(1);
}

const THEME_SCHEMA = `{
  "description": "one sentence describing the aesthetic (10-15 words)",
  "googleFontsUrl": "a valid Google Fonts CSS2 URL loading exactly two font families (display + body)",
  "colors": {
    "paper":       "#rrggbb",
    "paperMid":    "#rrggbb",
    "paperDark":   "#rrggbb",
    "ink":         "#rrggbb",
    "inkMid":      "#rrggbb",
    "inkLight":    "#rrggbb",
    "accent":      "#rrggbb",
    "accentLight": "#rrggbb",
    "cellBg":      "#rrggbb",
    "border":      "#rrggbb",
    "hlWord":      "#rrggbb",
    "hlCell":      "#rrggbb",
    "hlCellText":  "#rrggbb"
  },
  "fonts": {
    "display": "'Font Name', Georgia, serif",
    "body":    "'Font Name', Georgia, serif"
  }
}`;

const SYSTEM_PROMPT = `You are a visual designer creating unique themes for crossword puzzle web pages. Each theme must feel distinctly tied to its topic — someone should sense the subject immediately from the color palette and typography.

CSS variable mapping for context:
- paper → page/outer background (should be a warm or tinted light color, not pure white)
- paperMid → secondary surface used for the current-clue bar and hover states
- paperDark → borders, dividers, subtle shadows
- ink → primary text and black grid cells (dark, high contrast)
- inkMid → secondary text, muted labels
- inkLight → tertiary / inactive text
- accent → primary accent color used for active clue borders, direction toggle, CTA elements
- accentLight → hover variant of accent
- cellBg → white cell background (very light, close to white but tinted)
- border → grid lines separating cells
- hlWord → word-level highlight (muted — the whole word's background when selected)
- hlCell → selected-cell highlight (vivid — the single active cell)
- hlCellText → text color inside the selected cell (must contrast against hlCell)

Rules:
1. All colors must be 6-digit hex (#rrggbb).
2. hlCellText must be clearly readable on hlCell background (WCAG AA contrast ≥ 4.5:1).
3. ink on paper must meet WCAG AA (≥ 4.5:1).
4. hlWord should be muted/desaturated — it covers multiple cells and must not overwhelm.
5. Both font families must be available on Google Fonts.
6. googleFontsUrl must be a real, well-formed URL using the css2 API format.
7. Return ONLY the JSON object — no markdown fences, no explanation.`;

async function generateTheme(puzzleDir) {
  const jsonPath = path.join(ROOT, puzzleDir, 'crossword.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`crossword.json not found at ${jsonPath}`);
  }

  const raw   = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const p     = raw.puzzle;
  const title = p.title || puzzleDir;
  const words = [
    ...p.clues.across.map(cl => cl.word || cl.answer),
    ...p.clues.down.map(cl => cl.word || cl.answer),
  ].filter(Boolean);

  const userPrompt = `Design a visual theme for a crossword puzzle titled "${title}".

Answer words in this puzzle: ${words.join(', ')}

Return a JSON object matching this exact schema (replace all #rrggbb placeholders with real hex values):

${THEME_SCHEMA}`;

  console.log(`[${puzzleDir}] Calling Anthropic API…`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      // Thinking is on by default on Opus 5 and its tokens count toward
      // max_tokens, so leave headroom above the ~600 tokens of JSON we want.
      max_tokens: 4096,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const result = await response.json();

  if (result.stop_reason === 'refusal') {
    throw new Error(`API declined the request (${result.stop_details?.category ?? 'unknown'})`);
  }

  // With thinking on, content[0] is a thinking block — pick the text block.
  const text = result.content?.find(b => b.type === 'text')?.text ?? '';

  let theme;
  try {
    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
    theme = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse API response as JSON: ${text}`);
  }

  const outPath = path.join(ROOT, puzzleDir, 'theme.json');
  fs.writeFileSync(outPath, JSON.stringify(theme, null, 2) + '\n');
  console.log(`[${puzzleDir}] Wrote theme.json — ${theme.description}`);
  return theme;
}

(async () => {
  let failed = false;
  for (const dir of args) {
    try {
      await generateTheme(dir);
    } catch (e) {
      console.error(`[${dir}] ERROR: ${e.message}`);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
})();
