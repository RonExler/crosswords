#!/usr/bin/env node
/**
 * Validates crossword JSON files for structural and data correctness.
 *
 * Usage: node tests/validate.js [puzzleDir...]
 * Default: validates all puzzle directories (mapping, dogrescue)
 *
 * Exit code 1 if any errors found; 0 if all pass.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PUZZLES = ['mapping', 'dogrescue'];

const args = process.argv.slice(2);
const puzzleDirs = args.length ? args : DEFAULT_PUZZLES;

let globalErrors = 0;

for (const dir of puzzleDirs) {
  const jsonPath = path.join(ROOT, dir, 'crossword.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`[${dir}] ERROR: crossword.json not found at ${jsonPath}`);
    globalErrors++;
    continue;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error(`[${dir}] ERROR: JSON parse failed — ${e.message}`);
    globalErrors++;
    continue;
  }

  const errors = validatePuzzle(dir, raw);
  if (errors.length === 0) {
    console.log(`[${dir}] OK`);
  } else {
    for (const e of errors) console.error(`[${dir}] ERROR: ${e}`);
    globalErrors += errors.length;
  }
}

process.exit(globalErrors > 0 ? 1 : 0);


function validatePuzzle(name, raw) {
  const errors = [];

  if (!raw.puzzle)                  { errors.push('missing top-level "puzzle" key'); return errors; }
  const p = raw.puzzle;
  if (!p.grid || !Array.isArray(p.grid))  errors.push('puzzle.grid is missing or not an array');
  if (!p.clues || !p.clues.across)        errors.push('puzzle.clues.across is missing');
  if (!p.clues || !p.clues.down)          errors.push('puzzle.clues.down is missing');
  if (errors.length) return errors;

  const H = p.grid.length;
  const W = p.grid[0]?.length ?? 0;

  if (p.height && p.height !== H) errors.push(`puzzle.height=${p.height} but grid has ${H} rows`);
  if (p.width  && p.width  !== W) errors.push(`puzzle.width=${p.width} but grid has ${W} cols`);

  // Build cell map and numbered-cell index
  const numberedCells = {};  // number → [r, c]
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < p.grid[r].length; c++) {
      const cell = p.grid[r][c];
      if (cell && !cell.isBlack) {
        if (cell.letter && !/^[A-Z]$/.test(cell.letter))
          errors.push(`cell [${r},${c}] has invalid letter "${cell.letter}"`);
        if (cell.number != null) {
          if (numberedCells[cell.number])
            errors.push(`number ${cell.number} appears in more than one cell`);
          else
            numberedCells[cell.number] = [r, c];
        }
      }
    }
  }

  // Trace a word from a numbered cell in a given direction
  function traceWord(num, dir) {
    const start = numberedCells[num];
    if (!start) return null;
    const [sr, sc] = start;
    const letters = [];
    let r = sr, c = sc;
    while (r < H && c < W) {
      const cell = p.grid[r]?.[c];
      if (!cell || cell.isBlack) break;
      if (cell.letter) letters.push(cell.letter);
      if (dir === 'across') c++; else r++;
    }
    return letters.join('');
  }

  // Validate across clues
  const usedAcrossNums = new Set();
  for (const cl of p.clues.across) {
    if (cl.number == null)    { errors.push(`across clue missing "number" field: ${JSON.stringify(cl)}`); continue; }
    if (!cl.clue)             errors.push(`across clue #${cl.number} missing "clue" text`);
    const ans = cl.word || cl.answer;
    if (!ans)                 errors.push(`across clue #${cl.number} missing "word"/"answer"`);
    if (!numberedCells[cl.number])
      errors.push(`across clue #${cl.number} (${ans}): no cell numbered ${cl.number} in grid`);
    else {
      usedAcrossNums.add(cl.number);
      const traced = traceWord(cl.number, 'across');
      if (ans && traced !== ans)
        errors.push(`across clue #${cl.number}: word "${ans}" but grid traces "${traced}"`);
    }
  }

  // Validate down clues
  const usedDownNums = new Set();
  for (const cl of p.clues.down) {
    if (cl.number == null)    { errors.push(`down clue missing "number" field: ${JSON.stringify(cl)}`); continue; }
    if (!cl.clue)             errors.push(`down clue #${cl.number} missing "clue" text`);
    const ans = cl.word || cl.answer;
    if (!ans)                 errors.push(`down clue #${cl.number} missing "word"/"answer"`);
    if (!numberedCells[cl.number])
      errors.push(`down clue #${cl.number} (${ans}): no cell numbered ${cl.number} in grid`);
    else {
      usedDownNums.add(cl.number);
      const traced = traceWord(cl.number, 'down');
      if (ans && traced !== ans)
        errors.push(`down clue #${cl.number}: word "${ans}" but grid traces "${traced}"`);
    }
  }

  // Every numbered cell should start at least one word
  for (const [num, [r, c]] of Object.entries(numberedCells)) {
    const n = parseInt(num, 10);
    if (!usedAcrossNums.has(n) && !usedDownNums.has(n))
      errors.push(`cell #${n} at [${r},${c}] has a number but no clue references it`);
  }

  // Check for duplicate clue numbers within each direction
  const acrossNums = p.clues.across.map(cl => cl.number);
  const downNums   = p.clues.down.map(cl => cl.number);
  for (const num of acrossNums) {
    if (acrossNums.filter(n => n === num).length > 1)
      errors.push(`across clue #${num} appears more than once`);
  }
  for (const num of downNums) {
    if (downNums.filter(n => n === num).length > 1)
      errors.push(`down clue #${num} appears more than once`);
  }

  // Word length sanity — words should be >= 2 letters
  for (const cl of p.clues.across) {
    const ans = cl.word || cl.answer;
    if (ans && ans.length < 2)
      errors.push(`across clue #${cl.number} word "${ans}" is only ${ans.length} letter(s)`);
  }
  for (const cl of p.clues.down) {
    const ans = cl.word || cl.answer;
    if (ans && ans.length < 2)
      errors.push(`down clue #${cl.number} word "${ans}" is only ${ans.length} letter(s)`);
  }

  return errors;
}
