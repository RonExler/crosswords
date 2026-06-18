#!/usr/bin/env node
/**
 * Converts an Ingrid .jpz crossword file to crossword.json.
 *
 * Usage:
 *   node scripts/import-jpz.js <path/to/file.jpz> <puzzleDir>
 *
 * Example:
 *   node scripts/import-jpz.js "dogrescue/Dog Rescue.jpz" dogrescue
 *
 * Writes <puzzleDir>/crossword.json. Safe to run repeatedly (overwrites).
 * No npm dependencies required — Node.js 14+ only.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Args ──────────────────────────────────────────────────────────────────────

const [,, jpzArg, dirArg] = process.argv;
if (!jpzArg || !dirArg) {
  console.error('Usage: node scripts/import-jpz.js <file.jpz> <puzzleDir>');
  process.exit(1);
}

const ROOT    = path.resolve(__dirname, '..');
const jpzPath = path.resolve(ROOT, jpzArg);
const outDir  = path.resolve(ROOT, dirArg);
const outPath = path.join(outDir, 'crossword.json');

if (!fs.existsSync(jpzPath)) {
  console.error(`Not found: ${jpzPath}`);
  process.exit(1);
}

const xml = fs.readFileSync(jpzPath, 'utf8');

// ── XML helpers (no dependencies) ────────────────────────────────────────────

/** Parse key="value" attribute pairs from an attribute string. */
function parseAttrs(str) {
  const out = {};
  const re  = /([\w-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(str)) !== null) out[m[1]] = m[2];
  return out;
}

/** Decode XML entities to plain Unicode text. */
function decode(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g,         (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/** Return the inner content of the first <tag>...</tag> found, or null. */
function firstInner(src, tag) {
  const m = src.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : null;
}

// ── Parse grid ────────────────────────────────────────────────────────────────

const gridAttrStr = xml.match(/<grid([^>]*)>/)?.[1] ?? '';
const gridDims    = parseAttrs(gridAttrStr);
const W = parseInt(gridDims.width,  10);
const H = parseInt(gridDims.height, 10);
if (!W || !H) { console.error('Could not parse grid dimensions from <grid>'); process.exit(1); }

const gridContent = firstInner(xml, 'grid') ?? '';

// Build cell map: "x,y" → { solution, number, isBlock }
const cellMap = {};
const cellRe  = /<cell([^>]*?)\/>/g;
let cm;
while ((cm = cellRe.exec(gridContent)) !== null) {
  const a = parseAttrs(cm[1]);
  cellMap[`${a.x},${a.y}`] = {
    solution: a.solution ?? null,
    number:   a.number ? parseInt(a.number, 10) : null,
    isBlock:  a.type === 'block',
  };
}

// ── Parse words ───────────────────────────────────────────────────────────────

// wordMap: word_id (string) → [{x, y}, ...]
const wordMap = {};
const wordRe  = /<word\s+id="(\d+)">([\s\S]*?)<\/word>/g;
let wm;
while ((wm = wordRe.exec(xml)) !== null) {
  const id      = wm[1];
  const cells   = [];
  const cellsRe = /<cells([^>]*?)\/>/g;
  let cr;
  while ((cr = cellsRe.exec(wm[2])) !== null) {
    const ca = parseAttrs(cr[1]);
    cells.push({ x: parseInt(ca.x, 10), y: parseInt(ca.y, 10) });
  }
  wordMap[id] = cells;
}

// ── Parse clue sections ───────────────────────────────────────────────────────

function parseClueSection(sectionXml) {
  const clues = [];
  const re    = /<clue([^>]*)>([\s\S]*?)<\/clue>/g;
  let m;
  while ((m = re.exec(sectionXml)) !== null) {
    const a    = parseAttrs(m[1]);
    const text = decode(m[2].replace(/<[^>]+>/g, '')).trim();
    if (a.number && a.word) {
      clues.push({ number: parseInt(a.number, 10), wordId: a.word, clue: text });
    }
  }
  return clues.sort((a, b) => a.number - b.number);
}

// Two <clues> sections: first = Across, second = Down
const clueSections = [];
const cluesRe      = /<clues>([\s\S]*?)<\/clues>/g;
let cs;
while ((cs = cluesRe.exec(xml)) !== null) clueSections.push(cs[1]);

if (clueSections.length < 2) {
  console.error(`Expected 2 <clues> sections (Across + Down), found ${clueSections.length}`);
  process.exit(1);
}

const [acrossXml, downXml] = clueSections;
const acrossClues = parseClueSection(acrossXml);
const downClues   = parseClueSection(downXml);

// ── Build answer string for a word ────────────────────────────────────────────

function wordAnswer(wordId) {
  return (wordMap[wordId] ?? [])
    .map(({ x, y }) => cellMap[`${x},${y}`]?.solution ?? '?')
    .join('');
}

// ── Build grid (row-major, 0-based: grid[row][col]) ──────────────────────────
// JPZ uses x=column, y=row (both 1-based) → grid[y-1][x-1]

const grid = Array.from({ length: H }, (_, row) =>
  Array.from({ length: W }, (_, col) => {
    const cell = cellMap[`${col + 1},${row + 1}`];
    if (!cell || cell.isBlock) return null;
    return { letter: cell.solution, number: cell.number, isBlack: false };
  })
);

// ── Extract puzzle title ──────────────────────────────────────────────────────

// Title lives inside <metadata>, before the <clues> titles ("Across"/"Down")
const metaContent = firstInner(xml, 'metadata') ?? '';
const title = decode(firstInner(metaContent, 'title') ?? path.basename(dirArg));

// ── Assemble output ───────────────────────────────────────────────────────────

const output = {
  puzzle: {
    title,
    width:  W,
    height: H,
    grid,
    clues: {
      across: acrossClues.map(({ number, wordId, clue }) => ({
        number, clue, word: wordAnswer(wordId),
      })),
      down: downClues.map(({ number, wordId, clue }) => ({
        number, clue, word: wordAnswer(wordId),
      })),
    },
  },
};

// ── Write ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

console.log(`✓ Wrote ${path.relative(ROOT, outPath)}`);
console.log(`  Grid:  ${W}×${H}`);
console.log(`  Title: "${title}"`);
console.log(`  Clues: ${acrossClues.length} across, ${downClues.length} down`);
console.log(`\nNext steps:`);
console.log(`  node tests/validate.js ${dirArg}`);
console.log(`  npx wrangler pages deploy . --project-name=crosswords --branch=main`);
