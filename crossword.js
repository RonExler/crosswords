'use strict';

class CrosswordPuzzle {
  constructor(containerEl, puzzleData) {
    this.el = containerEl;
    this.data = puzzleData.puzzle;
    this.grid = this.data.grid;
    this.W = this.data.width;
    this.H = this.data.height;
    this.cluesData = this.data.clues;

    this.dir = 'across';
    this.selRow = -1;
    this.selCol = -1;

    this.userGrid  = Array.from({ length: this.H }, () => Array(this.W).fill(''));
    this.cellEls   = {};    // "r,c" → div
    this.words     = {};    // "across-N" / "down-N" → [[r,c], ...]
    this.cellWords = {};    // "r,c" → { across: wid|null, down: wid|null }

    this._buildWords();
    this._render();
    this._bindInput();
    this._bindClueBarToggle();
    requestAnimationFrame(() => {
      this._updateCellSize();
      this._selectFirstWord();
    });
  }

  // ── Word discovery ────────────────────────────────────────────

  _buildWords() {
    for (const cl of this.cluesData.across) this._traceWord('across', cl.number);
    for (const cl of this.cluesData.down)   this._traceWord('down',   cl.number);

    for (const [wid, cells] of Object.entries(this.words)) {
      const dir = wid.startsWith('across') ? 'across' : 'down';
      for (const [r, c] of cells) {
        const key = `${r},${c}`;
        if (!this.cellWords[key]) this.cellWords[key] = { across: null, down: null };
        this.cellWords[key][dir] = wid;
      }
    }
  }

  _traceWord(dir, num) {
    const start = this._findNumber(num);
    if (!start) return;
    const [sr, sc] = start;
    const cells = [];
    let r = sr, c = sc;
    while (r < this.H && c < this.W) {
      const cell = this.grid[r][c];
      if (!cell || cell.isBlack) break;
      cells.push([r, c]);
      if (dir === 'across') c++; else r++;
    }
    if (cells.length >= 1) this.words[`${dir}-${num}`] = cells;
  }

  _findNumber(num) {
    for (let r = 0; r < this.H; r++)
      for (let c = 0; c < this.W; c++) {
        const cell = this.grid[r][c];
        if (cell && !cell.isBlack && cell.number === num) return [r, c];
      }
    return null;
  }

  // ── Rendering ─────────────────────────────────────────────────

  _render() {
    const container = this.el.querySelector('.cw-grid-container');

    const gridEl = document.createElement('div');
    gridEl.className = 'cw-grid';
    gridEl.style.setProperty('--cols', this.W);
    gridEl.style.setProperty('--rows', this.H);
    this.gridEl = gridEl;

    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < this.W; c++) {
        const rawCell = this.grid[r][c];
        const el = document.createElement('div');
        el.className = 'cw-cell';

        if (!rawCell || rawCell.isBlack) {
          el.classList.add('cw-black');
        } else {
          el.classList.add('cw-white');

          if (rawCell.number) {
            const numEl = document.createElement('span');
            numEl.className = 'cw-num';
            numEl.textContent = rawCell.number;
            el.appendChild(numEl);
          }

          const letterEl = document.createElement('span');
          letterEl.className = 'cw-letter';
          el.appendChild(letterEl);

          el.addEventListener('click', () => this._clickCell(r, c));
          this.cellEls[`${r},${c}`] = el;
        }

        gridEl.appendChild(el);
      }
    }

    container.appendChild(gridEl);

    if (window.ResizeObserver) {
      new ResizeObserver(() => this._updateCellSize()).observe(container);
    } else {
      window.addEventListener('resize', () => this._updateCellSize());
    }

    this._renderClues();
  }

  _updateCellSize() {
    const container = this.el.querySelector('.cw-grid-container');
    if (!container) return;
    const available = container.clientWidth;
    if (!available) return;
    const size = Math.max(22, Math.min(44, Math.floor(available / this.W)));
    this.gridEl.style.setProperty('--cell-size', `${size}px`);
  }

  _renderClues() {
    const acrossEl = this.el.querySelector('.cw-clues-across');
    const downEl   = this.el.querySelector('.cw-clues-down');
    for (const cl of this.cluesData.across)
      acrossEl.appendChild(this._makeClueItem(`across-${cl.number}`, cl.number, cl.clue));
    for (const cl of this.cluesData.down)
      downEl.appendChild(this._makeClueItem(`down-${cl.number}`, cl.number, cl.clue));
  }

  _makeClueItem(wid, num, clue) {
    const li = document.createElement('li');
    li.dataset.wid = wid;
    li.innerHTML = `<span class="cw-clue-num">${num}</span>${clue}`;
    li.addEventListener('click', () => this._jumpToWord(wid));
    return li;
  }

  // ── Input binding ─────────────────────────────────────────────

  _bindInput() {
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'text';
    this.hiddenInput.className = 'cw-hidden-input';
    this.hiddenInput.setAttribute('autocomplete', 'off');
    this.hiddenInput.setAttribute('autocorrect', 'off');
    this.hiddenInput.setAttribute('autocapitalize', 'characters');
    this.hiddenInput.setAttribute('spellcheck', 'false');
    this.hiddenInput.setAttribute('inputmode', 'text');
    document.body.appendChild(this.hiddenInput);

    this.hiddenInput.addEventListener('keydown', (e) => this._handleKey(e));
    this.hiddenInput.addEventListener('input', () => {
      const v = this.hiddenInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      this.hiddenInput.value = '';
      if (v) this._typeCell(v[v.length - 1]);
    });

    const container = this.el.querySelector('.cw-grid-container');
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', (e) => this._handleKey(e));
  }

  // Tapping the clue bar toggles across ↔ down on the current cell
  _bindClueBarToggle() {
    const bar = this.el.querySelector('.cw-clue-bar');
    if (!bar) return;
    bar.style.cursor = 'pointer';
    bar.setAttribute('title', 'Tap to switch direction');
    bar.addEventListener('click', () => {
      if (this.selRow < 0) return;
      const wi = this.cellWords[`${this.selRow},${this.selCol}`];
      if (wi && wi.across && wi.down) {
        this.dir = this.dir === 'across' ? 'down' : 'across';
        this._sync();
      }
    });
  }

  _focusForInput() {
    if (window.matchMedia('(hover: none)').matches) {
      this.hiddenInput.focus({ preventScroll: true });
    } else {
      this.el.querySelector('.cw-grid-container').focus({ preventScroll: true });
    }
  }

  _handleKey(e) {
    if (this.selRow < 0) return;

    switch (e.key) {
      case 'Backspace':
        e.preventDefault(); this._handleBackspace(); break;

      case 'Delete':
        e.preventDefault(); this._clearCell(this.selRow, this.selCol); break;

      case 'Tab':
        e.preventDefault(); this._advanceWord(e.shiftKey ? -1 : 1); break;

      case 'ArrowLeft':
        e.preventDefault();
        if (this.dir !== 'across') { this.dir = 'across'; this._sync(); }
        else this._navigate(0, -1);
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (this.dir !== 'across') { this.dir = 'across'; this._sync(); }
        else this._navigate(0, 1);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (this.dir !== 'down') { this.dir = 'down'; this._sync(); }
        else this._navigate(-1, 0);
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (this.dir !== 'down') { this.dir = 'down'; this._sync(); }
        else this._navigate(1, 0);
        break;

      default:
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
          e.preventDefault(); this._typeCell(e.key.toUpperCase());
        }
    }
  }

  // ── Navigation ────────────────────────────────────────────────

  _navigate(dr, dc) {
    let r = this.selRow + dr;
    let c = this.selCol + dc;
    while (r >= 0 && r < this.H && c >= 0 && c < this.W) {
      const cell = this.grid[r][c];
      if (cell && !cell.isBlack && this.cellWords[`${r},${c}`]) {
        this.selRow = r; this.selCol = c;
        const wi = this.cellWords[`${r},${c}`];
        if (!wi[this.dir]) this.dir = wi.across ? 'across' : 'down';
        this._sync();
        return;
      }
      r += dr; c += dc;
    }
  }

  _typeCell(letter) {
    if (this.selRow < 0) return;
    const r = this.selRow, c = this.selCol;
    this.userGrid[r][c] = letter;
    const el = this.cellEls[`${r},${c}`];
    if (el) {
      el.querySelector('.cw-letter').textContent = letter;
      el.classList.remove('cw-correct', 'cw-wrong', 'cw-revealed');
    }
    this._advanceInWord();
  }

  _clearCell(r, c) {
    this.userGrid[r][c] = '';
    const el = this.cellEls[`${r},${c}`];
    if (el) {
      el.querySelector('.cw-letter').textContent = '';
      el.classList.remove('cw-correct', 'cw-wrong', 'cw-revealed');
    }
  }

  _handleBackspace() {
    const r = this.selRow, c = this.selCol;
    if (this.userGrid[r][c]) {
      this._clearCell(r, c);
    } else {
      this._retreatInWord();
      this._clearCell(this.selRow, this.selCol);
    }
  }

  _advanceInWord() {
    const wid = this._currentWordId();
    if (!wid) return;
    const cells = this.words[wid];
    const idx = cells.findIndex(([r, c]) => r === this.selRow && c === this.selCol);
    if (idx < 0) return;
    for (let i = idx + 1; i < cells.length; i++) {
      const [r, c] = cells[i];
      if (!this.userGrid[r][c]) {
        this.selRow = r; this.selCol = c; this._sync(); return;
      }
    }
    if (idx < cells.length - 1) {
      [this.selRow, this.selCol] = cells[idx + 1]; this._sync();
    }
  }

  _retreatInWord() {
    const wid = this._currentWordId();
    if (!wid) return;
    const cells = this.words[wid];
    const idx = cells.findIndex(([r, c]) => r === this.selRow && c === this.selCol);
    if (idx > 0) { [this.selRow, this.selCol] = cells[idx - 1]; this._sync(); }
  }

  // ── Selection ─────────────────────────────────────────────────

  _clickCell(r, c) {
    const wi = this.cellWords[`${r},${c}`];
    if (!wi) return;

    if (r === this.selRow && c === this.selCol) {
      // Same cell: toggle direction if it participates in both
      if (wi.across && wi.down) {
        this.dir = this.dir === 'across' ? 'down' : 'across';
      }
    } else {
      this.selRow = r; this.selCol = c;
      if (!wi[this.dir]) this.dir = wi.across ? 'across' : 'down';
    }

    this._sync();
    this._focusForInput();
  }

  _jumpToWord(wid) {
    if (!this.words[wid]) return;
    const dir = wid.startsWith('across') ? 'across' : 'down';
    this.dir = dir;
    const cells = this.words[wid];
    let target = cells[0];
    for (const [r, c] of cells) {
      if (!this.userGrid[r][c]) { target = [r, c]; break; }
    }
    [this.selRow, this.selCol] = target;
    this._sync();
    // Scroll selected cell into grid view (grid container only, not the page)
    const el = this.cellEls[`${this.selRow},${this.selCol}`];
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  _advanceWord(delta) {
    const order = this._wordOrder();
    if (!order.length) return;
    const cur = this._currentWordId();
    const idx = order.indexOf(cur);
    const next = ((idx + delta) % order.length + order.length) % order.length;
    this._jumpToWord(order[next]);
  }

  _wordOrder() {
    const ac = this.cluesData.across.map(cl => `across-${cl.number}`).filter(id => this.words[id]);
    const dn = this.cluesData.down.map(cl => `down-${cl.number}`).filter(id => this.words[id]);
    return [...ac, ...dn];
  }

  _currentWordId() {
    if (this.selRow < 0) return null;
    const wi = this.cellWords[`${this.selRow},${this.selCol}`];
    if (!wi) return null;
    return wi[this.dir] || wi.across || wi.down;
  }

  _toggleDirection() {
    if (this.selRow < 0) return;
    const wi = this.cellWords[`${this.selRow},${this.selCol}`];
    if (wi && wi.across && wi.down) {
      this.dir = this.dir === 'across' ? 'down' : 'across';
      this._sync();
    }
  }

  _selectFirstWord() {
    const order = this._wordOrder();
    if (order.length) this._jumpToWord(order[0]);
  }

  // ── UI sync ───────────────────────────────────────────────────

  _sync() {
    this._updateHighlight();
    this._updateClueHighlight();
    this._updateCurrentClue();
  }

  _updateHighlight() {
    for (const el of Object.values(this.cellEls)) {
      el.classList.remove('cw-selected', 'cw-highlighted');
      el.removeAttribute('data-dir');
    }
    const wid = this._currentWordId();
    if (!wid) return;
    for (const [r, c] of (this.words[wid] || [])) {
      const el = this.cellEls[`${r},${c}`];
      if (el) el.classList.add('cw-highlighted');
    }
    const sel = this.cellEls[`${this.selRow},${this.selCol}`];
    if (sel) {
      sel.classList.remove('cw-highlighted');
      sel.classList.add('cw-selected');
      sel.dataset.dir = this.dir;
    }
  }

  _updateClueHighlight() {
    for (const li of this.el.querySelectorAll('.cw-clues li')) {
      li.classList.remove('cw-clue-active');
    }
    const wid = this._currentWordId();
    if (!wid) return;
    const li = this.el.querySelector(`[data-wid="${wid}"]`);
    if (!li) return;
    li.classList.add('cw-clue-active');
    // Scroll within the panel only — never scroll the whole page
    this._scrollClueIntoPanel(li);
  }

  _scrollClueIntoPanel(li) {
    const panel = this.el.querySelector('.cw-clue-panel');
    // Only scroll if the panel itself is the scrollable container
    if (!panel || panel.scrollHeight <= panel.clientHeight + 4) return;
    const panelRect  = panel.getBoundingClientRect();
    const liRect     = li.getBoundingClientRect();
    const liRelTop   = liRect.top  - panelRect.top  + panel.scrollTop;
    const liRelBot   = liRect.bottom - panelRect.top + panel.scrollTop;
    const target     = liRelTop - panel.clientHeight / 2 + li.offsetHeight / 2;
    if (liRect.top < panelRect.top + 20 || liRect.bottom > panelRect.bottom - 20) {
      panel.scrollTop = Math.max(0, target);
    }
  }

  _updateCurrentClue() {
    const bar = this.el.querySelector('.cw-clue-bar-text');
    if (!bar) return;
    const wid = this._currentWordId();
    if (!wid) { bar.innerHTML = ''; return; }

    const [dir, numStr] = wid.split('-');
    const num = parseInt(numStr, 10);
    const clue = this.cluesData[dir]?.find(cl => cl.number === num);
    if (!clue) return;

    // Check if this intersection cell also has the other direction
    const wi = this.cellWords[`${this.selRow},${this.selCol}`];
    const canToggle = wi && wi.across && wi.down;

    const dirLabel  = dir === 'across' ? 'Across' : 'Down';
    const otherDir  = dir === 'across' ? 'Down' : 'Across';
    const toggleHint = canToggle
      ? `<span class="cw-dir-toggle" title="Tap to switch to ${otherDir}">${dirLabel} <span class="cw-dir-arrow">⇄</span></span>`
      : `<span class="cw-dir-label">${dirLabel}</span>`;

    bar.innerHTML = `<strong>${num}&thinsp;${toggleHint}</strong> — ${clue.clue}`;

    // Wire up the inline toggle button
    const btn = bar.querySelector('.cw-dir-toggle');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleDirection(); });
  }

  // ── Public controls ───────────────────────────────────────────

  checkAnswers() {
    let allFilled = true;
    for (const [key, el] of Object.entries(this.cellEls)) {
      const [r, c] = key.split(',').map(Number);
      const user = this.userGrid[r][c];
      if (!user) { allFilled = false; continue; }
      const correct = this.grid[r][c]?.letter;
      el.classList.remove('cw-correct', 'cw-wrong', 'cw-revealed');
      el.classList.add(user === correct ? 'cw-correct' : 'cw-wrong');
    }
    if (allFilled) {
      const allCorrect = Object.keys(this.cellEls).every(key => {
        const [r, c] = key.split(',').map(Number);
        return this.userGrid[r][c] === this.grid[r][c]?.letter;
      });
      if (allCorrect) setTimeout(() => alert('Congratulations — puzzle solved!'), 100);
    }
  }

  revealLetter() {
    if (this.selRow < 0) return;
    const r = this.selRow, c = this.selCol;
    const correct = this.grid[r][c]?.letter;
    if (!correct) return;
    this.userGrid[r][c] = correct;
    const el = this.cellEls[`${r},${c}`];
    if (el) {
      el.querySelector('.cw-letter').textContent = correct;
      el.classList.remove('cw-wrong');
      el.classList.add('cw-correct', 'cw-revealed');
    }
    this._advanceInWord();
  }

  clearAll() {
    for (const [key, el] of Object.entries(this.cellEls)) {
      const [r, c] = key.split(',').map(Number);
      this.userGrid[r][c] = '';
      el.querySelector('.cw-letter').textContent = '';
      el.classList.remove('cw-correct', 'cw-wrong', 'cw-revealed');
    }
  }

  revealAll() {
    for (const [key, el] of Object.entries(this.cellEls)) {
      const [r, c] = key.split(',').map(Number);
      const correct = this.grid[r][c]?.letter;
      if (!correct) continue;
      this.userGrid[r][c] = correct;
      el.querySelector('.cw-letter').textContent = correct;
      el.classList.remove('cw-wrong');
      el.classList.add('cw-correct', 'cw-revealed');
    }
  }
}

window.CrosswordPuzzle = CrosswordPuzzle;
