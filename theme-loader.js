'use strict';

function applyTheme(theme) {
  const root = document.documentElement;
  const c = theme.colors || {};

  const map = {
    paper:       '--paper',
    paperMid:    '--paper-mid',
    paperDark:   '--paper-dark',
    ink:         '--ink',
    inkMid:      '--ink-mid',
    inkLight:    '--ink-light',
    accent:      '--gold',
    accentLight: '--gold-light',
    cellBg:      '--cell-bg',
    border:      '--border',
    hlWord:      '--hl-word',
    hlCell:      '--hl-cell',
    hlCellText:  '--hl-cell-text',
  };

  for (const [key, cssVar] of Object.entries(map)) {
    if (c[key]) root.style.setProperty(cssVar, c[key]);
  }

  if (theme.fonts?.display) root.style.setProperty('--font-display', theme.fonts.display);
  if (theme.fonts?.body)    root.style.setProperty('--font-body',    theme.fonts.body);

  if (theme.googleFontsUrl) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = theme.googleFontsUrl;
    document.head.appendChild(link);
  }
}

async function initPuzzle(appId, btnIds) {
  const [themeResult, dataResult] = await Promise.allSettled([
    fetch('theme.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('crossword.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]);

  if (themeResult.status === 'fulfilled') {
    applyTheme(themeResult.value);
  }

  if (dataResult.status === 'rejected') {
    document.querySelector('.cw-grid-container').textContent =
      'Could not load puzzle data. ' + dataResult.reason?.message;
    return;
  }

  const puzzle = new CrosswordPuzzle(document.getElementById(appId), dataResult.value);

  if (btnIds.check)     document.getElementById(btnIds.check).addEventListener('click',     () => puzzle.checkAnswers());
  if (btnIds.reveal)    document.getElementById(btnIds.reveal).addEventListener('click',    () => puzzle.revealLetter());
  if (btnIds.clear)     document.getElementById(btnIds.clear).addEventListener('click',     () => puzzle.clearAll());
  if (btnIds.revealAll) document.getElementById(btnIds.revealAll).addEventListener('click', () => puzzle.revealAll());
}
