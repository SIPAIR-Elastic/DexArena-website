// Progressive enhancements for the results explorer. The shared site script
// remains responsible for selecting result tracks, presentation modes and rows.
(() => {
  const root = document.querySelector('[data-leaderboard-enhanced]');
  if (!root) return;

  const all = (scope, selector) => [...scope.querySelectorAll(selector)];
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamp = (value, max) => Math.min(max, Math.max(0, value));
  const hiddenWithin = (element, boundary) => {
    for (let node = element; node; node = node.parentElement) {
      if (node.hidden) return true;
      if (node === boundary) break;
    }
    return false;
  };
  const makeStatus = (element, label) => {
    if (!element) return;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    if (label && !element.getAttribute('aria-label')) element.setAttribute('aria-label', label);
  };

  all(root, '[data-ranking-chart]').forEach(chart => {
    const buttons = all(chart, '[data-chart-scale]');
    const ticks = all(chart, '[data-axis-tick]');
    const note = chart.querySelector('[data-scale-note]');
    const fullScaleNote = note?.textContent.trim() || 'Full scale: 0–100%. All tracks share the same success-rate scale.';
    makeStatus(note, 'Chart scale');
    const selectScale = requested => {
      const detailMax = number(chart.dataset.detailScale);
      const detail = requested === 'detail' && detailMax > 0;
      const max = detail ? detailMax : number(chart.dataset.fullScale) || 100;
      chart.dataset.scale = detail ? 'detail' : 'full';
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.chartScale === chart.dataset.scale)));
      ticks.forEach((tick, index) => {
        const value = max * index / Math.max(1, ticks.length - 1);
        tick.textContent = Number(value.toFixed(2)).toString();
      });
      all(chart, '.chart-row').forEach(row => {
        const mean = number(row.dataset.mean);
        const bar = row.querySelector('.chart-bar');
        if (bar) bar.style.width = `${clamp(mean, max) / max * 100}%`;
        const whisker = row.querySelector('.chart-whisker');
        if (whisker) {
          const std = Math.max(0, number(row.dataset.std));
          const low = clamp(mean - std, max);
          const high = clamp(mean + std, max);
          whisker.style.left = `${low / max * 100}%`;
          whisker.style.width = `${Math.max(0, high - low) / max * 100}%`;
        }
      });
      if (note) note.textContent = detail
        ? `Detail scale: 0–${max}%. Success rates are unchanged.`
        : fullScaleNote;
    };
    buttons.forEach(button => button.addEventListener('click', () => selectScale(button.dataset.chartScale)));
    selectScale('full');
  });

  const heatmaps = all(root, '[data-heatmap]').map(map => {
    const cells = all(map, '[data-heat-cell]');
    const rows = all(map, '[data-heat-row]');
    const search = map.querySelector('[data-heat-search]');
    const count = map.querySelector('[data-heat-count]');
    const empty = map.querySelector('[data-heat-empty]');
    const detail = map.querySelector('[data-heat-detail]');
    let selected = null;
    makeStatus(count, 'Visible benchmark rows');
    makeStatus(detail, 'Selected benchmark result');
    const setDetail = (selector, value) => {
      const target = detail?.querySelector(selector);
      if (target) target.textContent = value;
    };
    const visibleCells = () => cells.filter(cell => !hiddenWithin(cell, map));
    const showDetail = cell => {
      setDetail('[data-detail-method]', cell.dataset.method || '');
      setDetail('[data-detail-task]', cell.dataset.task || '');
      setDetail('[data-detail-stage]', cell.dataset.stage || 'Full sequence');
      setDetail('[data-detail-value]', `${number(cell.dataset.mean).toFixed(1)}%`);
      setDetail('[data-detail-uncertainty]', cell.dataset.std !== undefined && cell.dataset.std !== ''
        ? `± ${number(cell.dataset.std).toFixed(1)} percentage points · scene standard deviation`
        : 'Success rate');
    };
    const select = (cell, focus = false) => {
      selected = cell;
      cells.forEach(item => {
        item.tabIndex = item === cell ? 0 : -1;
        item.classList.toggle('is-selected', item === cell);
      });
      if (cell) {
        showDetail(cell);
        if (focus) cell.focus();
      }
    };
    const refresh = () => {
      const tokens = (search?.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      rows.forEach(row => {
        const text = (row.dataset.searchText || row.textContent).toLowerCase();
        row.hidden = !tokens.every(token => text.includes(token));
      });
      all(map, '[data-task-group]').forEach(group => {
        group.hidden = !all(group, '[data-heat-row]').some(row => !row.hidden);
      });
      const visibleRows = rows.filter(row => !hiddenWithin(row, map)).length;
      if (count) count.textContent = `${visibleRows} of ${rows.length} ${map.dataset.rowLabel || 'stages'}`;
      if (empty) empty.hidden = visibleRows > 0;
      const visible = visibleCells();
      if (!visible.includes(selected)) select(visible[0] || null);
      else select(selected);
      if (!visible.length) {
        setDetail('[data-detail-method]', 'No matching result');
        setDetail('[data-detail-task]', 'Try a different search or method family.');
        setDetail('[data-detail-stage]', '');
        setDetail('[data-detail-value]', '—');
        setDetail('[data-detail-uncertainty]', '');
      }
    };
    cells.forEach(cell => {
      cell.addEventListener('mouseenter', () => select(cell));
      cell.addEventListener('focus', () => select(cell));
      cell.addEventListener('click', () => select(cell, true));
      cell.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); select(cell); return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const visible = visibleCells();
        const row = number(cell.dataset.row), col = number(cell.dataset.col);
        const sameRow = visible.filter(item => number(item.dataset.row) === row);
        const sameCol = visible.filter(item => number(item.dataset.col) === col);
        let next = cell;
        if (event.key === 'Home') next = (event.ctrlKey || event.metaKey ? visible : sameRow)[0];
        if (event.key === 'End') next = (event.ctrlKey || event.metaKey ? visible : sameRow).at(-1);
        if (event.key === 'ArrowLeft') next = sameRow[Math.max(0, sameRow.indexOf(cell) - 1)];
        if (event.key === 'ArrowRight') next = sameRow[Math.min(sameRow.length - 1, sameRow.indexOf(cell) + 1)];
        if (event.key === 'ArrowUp') next = sameCol[Math.max(0, sameCol.indexOf(cell) - 1)];
        if (event.key === 'ArrowDown') next = sameCol[Math.min(sameCol.length - 1, sameCol.indexOf(cell) + 1)];
        if (next) select(next, true);
      });
    });
    search?.addEventListener('input', refresh);
    refresh();
    return {refresh};
  });

  const family = root.querySelector('[data-method-filter]');
  const columns = all(root, '[data-method-column][data-family]');
  const familyStatus = root.querySelector('[data-family-status]');
  makeStatus(familyStatus, 'Visible methods');
  const syncFamily = () => {
    const value = family?.value || 'all';
    columns.forEach(column => column.hidden = value !== 'all' && !column.dataset.family.toLowerCase().includes(value));
    const chart = root.querySelector('[data-ranking-chart]');
    const methods = chart ? all(chart, '.chart-row') : [];
    const shown = methods.filter(method => value === 'all' || (method.dataset.family || '').toLowerCase().includes(value)).length;
    if (familyStatus) familyStatus.textContent = `${shown} of ${methods.length} methods`;
    all(root, '[data-group-heading]').forEach(heading => heading.colSpan = shown + 1);
    all(root, '.heatmap-table, .results-table').forEach(table => table.style.setProperty('--visible-methods', String(shown)));
    heatmaps.forEach(map => map.refresh());
  };
  family?.addEventListener('change', syncFamily);
  syncFamily();

  // These are pressed-state button groups, not ARIA tablists. Keep the existing
  // click handlers authoritative while offering predictable arrow navigation.
  ['[data-result-tab]', '[data-view-button]'].forEach(selector => {
    const buttons = all(root, selector);
    buttons.forEach(button => button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = buttons.indexOf(button);
      const next = event.key === 'Home' ? buttons[0]
        : event.key === 'End' ? buttons.at(-1)
        : buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
      next.click(); next.focus();
    }));
  });
})();
