// Progressive enhancements for the results explorer. The shared site script
// remains responsible for selecting result tracks and presentation modes.
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
  const ancestor = (element, predicate) => {
    for (let node = element; node; node = node.parentElement) if (predicate(node)) return node;
    return null;
  };
  const tabs = all(root, '[data-result-tab]');
  const views = all(root, '[data-view-button]');
  const panels = all(root, '[data-result-panel]');
  const trackOf = element => ancestor(element, node => node.dataset?.resultPanel !== undefined)?.dataset.resultPanel || tabs[0]?.dataset.resultTab || 'stage';
  const family = root.querySelector('[data-method-filter]');
  const methodSearch = root.querySelector('[data-method-search]');
  const order = root.querySelector('[data-rank-order]');
  const defaults = {track: tabs[0]?.dataset.resultTab || 'stage', view: 'charts', family: 'all', method: '', order: 'score', scale: 'full', task: ''};
  const boundedText = (value, max = 120) => String(value || '').slice(0, max);
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replaceAll('π', 'pi').replace(/\bgr00t\b/g, 'groot').replace(/\bpi[\s._-]*0[\s._-]*5\b/g, 'pi05');
  const familyValue = value => ['all', 'rl', 'imitation', 'vla'].includes(value) ? value : 'all';
  const browser = typeof window === 'object' ? window : null;
  let state = {...defaults};
  let restoring = false;
  let writeState = () => {};

  const charts = all(root, '[data-ranking-chart]').map(chart => {
    const buttons = all(chart, '[data-chart-scale]');
    const ticks = all(chart, '[data-axis-tick]');
    const note = chart.querySelector('[data-scale-note]');
    const fullScaleNote = note?.textContent.trim() || 'Full scale: 0–100%. All tracks share the same success-rate scale.';
    makeStatus(note, 'Chart scale');
    const selectScale = requested => {
      const detailMax = number(chart.dataset.detailScale);
      const detail = requested === 'detail' && detailMax > 0 && buttons.some(button => button.dataset.chartScale === 'detail');
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
    buttons.forEach(button => button.addEventListener('click', () => {
      selectScale(button.dataset.chartScale);
      if (!restoring && trackOf(chart) === state.track) {state.scale = chart.dataset.scale; writeState();}
    }));
    selectScale('full');
    return {element: chart, track: trackOf(chart), selectScale};
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
      const visible = visibleCells();
      if (empty) {
        empty.hidden = visible.length > 0;
        empty.textContent = visibleRows > 0
          ? 'No matching methods. Adjust the method search or family filter.'
          : 'No matching tasks or stages. Try a shorter name.';
      }
      if (!visible.includes(selected)) select(visible[0] || null);
      else select(selected);
      if (!visible.length) {
        setDetail('[data-detail-method]', 'No matching result');
        setDetail('[data-detail-task]', visibleRows > 0 ? 'Adjust the method search or family filter.' : 'Try a different task or stage search.');
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
    search?.addEventListener('input', () => {
      const value = boundedText(search.value, 160);
      if (search.value !== value) search.value = value;
      refresh();
      if (!restoring && trackOf(map) === state.track) {state.task = search.value; writeState();}
    });
    refresh();
    return {refresh, search, track: trackOf(map)};
  });

  const columns = all(root, '[data-method-column][data-family]');
  const methodRows = all(root, '[data-method-row], [data-visual-method], [data-method-card]');
  const familyStatus = root.querySelector('[data-family-status]');
  makeStatus(familyStatus, 'Visible methods');
  const matchesMethod = element => {
    const value = familyValue(family?.value || state.family);
    const tokens = normalize(methodSearch?.value || state.method).trim().split(/\s+/).filter(Boolean);
    const name = normalize(element.dataset.method || element.dataset.distributionMethod || element.textContent);
    return (value === 'all' || (element.dataset.family || '').toLowerCase().includes(value)) && tokens.every(token => name.includes(token));
  };
  const syncMethods = () => {
    columns.forEach(column => column.hidden = !matchesMethod(column));
    methodRows.forEach(row => row.hidden = !matchesMethod(row));
    const chart = charts.find(item => item.track === state.track)?.element || charts[0]?.element;
    const methods = chart ? all(chart, '.chart-row') : [];
    const shown = methods.filter(matchesMethod).length;
    if (familyStatus) familyStatus.textContent = `${shown} of ${methods.length} methods`;
    all(root, '[data-method-empty]').forEach(empty => empty.hidden = shown > 0);
    all(root, '[data-group-heading]').forEach(heading => heading.colSpan = shown + 1);
    all(root, '.heatmap-table, .results-table').forEach(table => table.style.setProperty('--visible-methods', String(shown)));
    heatmaps.forEach(map => map.refresh());
  };
  const originalPosition = new Map();
  all(root, '.chart-row, .distribution-row, [data-method-row]').forEach((row, index) => originalPosition.set(row, index));
  const syncOrder = () => {
    const scope = panels.find(panel => panel.dataset.resultPanel === state.track) || root;
    const means = new Map(all(scope, '.chart-row').map(row => [row.dataset.method, number(row.dataset.mean)]));
    const parents = new Map();
    all(scope, '.chart-row, .distribution-row, [data-method-row]').forEach(row => {
      if (!parents.has(row.parentElement)) parents.set(row.parentElement, []);
      parents.get(row.parentElement).push(row);
    });
    parents.forEach((rows, parent) => {
      const boundary = rows.at(-1).nextSibling;
      const mean = row => row.dataset.mean === undefined ? means.get(row.dataset.method) || 0 : number(row.dataset.mean);
      rows.sort((a, b) => (state.order === 'name'
        ? (a.dataset.method || '').localeCompare(b.dataset.method || '', 'en', {sensitivity: 'base', numeric: true})
        : mean(b) - mean(a)) || originalPosition.get(a) - originalPosition.get(b));
      rows.forEach(row => parent.insertBefore(row, boundary || null));
    });
  };
  const filterChanged = () => {
    state.family = familyValue(family?.value);
    state.method = boundedText(methodSearch?.value);
    if (methodSearch && methodSearch.value !== state.method) methodSearch.value = state.method;
    syncMethods(); writeState();
  };
  family?.addEventListener('change', filterChanged);
  methodSearch?.addEventListener('input', filterChanged);
  order?.addEventListener('change', () => {
    state.order = order.value === 'name' ? 'name' : 'score';
    syncOrder(); writeState();
  });

  const url = () => {
    if (!browser?.location?.href || typeof URL !== 'function') return null;
    try {return new URL(browser.location.href);} catch {return null;}
  };
  const hashTrack = hash => tabs.find(tab => hash === `#results-${tab.dataset.resultTab}`)?.dataset.resultTab;
  const readState = (preferHash = false) => {
    const current = url();
    if (!current) return {...defaults};
    const query = current.searchParams;
    const queryTrack = tabs.find(tab => tab.dataset.resultTab === query.get('track'))?.dataset.resultTab;
    const track = (preferHash && hashTrack(current.hash)) || queryTrack || hashTrack(current.hash) || defaults.track;
    return {
      track,
      view: ['charts', 'heatmap', 'tables'].includes(query.get('view')) ? query.get('view') : 'charts',
      family: familyValue(query.get('family')),
      method: boundedText(query.get('method')),
      order: query.get('order') === 'name' ? 'name' : 'score',
      scale: track === 'longHorizon' && query.get('scale') === 'detail' ? 'detail' : 'full',
      task: boundedText(query.get('task'), 160)
    };
  };
  writeState = () => {
    if (restoring) return;
    const current = url();
    if (!current || !browser?.history?.replaceState) return;
    for (const key of ['track', 'view', 'family', 'order', 'scale']) current.searchParams.set(key, state[key]);
    for (const key of ['method', 'task']) {
      if (state[key]) current.searchParams.set(key, state[key]); else current.searchParams.delete(key);
    }
    if (hashTrack(current.hash)) current.hash = `results-${state.track}`;
    if (current.href !== browser.location.href) {
      try {browser.history.replaceState(browser.history.state, '', current.href);} catch {/* Filtering still works when history access is restricted. */}
    }
  };
  const restore = next => {
    restoring = true;
    try {
      state = {...defaults, ...next};
      if (family) family.value = state.family;
      if (methodSearch) methodSearch.value = state.method;
      if (order) order.value = state.order;
      tabs.find(tab => tab.dataset.resultTab === state.track)?.click();
      views.find(view => view.dataset.viewButton === state.view)?.click();
      const map = heatmaps.find(item => item.track === state.track);
      if (map?.search) map.search.value = state.task;
      charts.forEach(item => item.selectScale(item.track === state.track ? state.scale : 'full'));
      syncMethods(); syncOrder();
    } finally {restoring = false;}
  };
  tabs.forEach(tab => tab.addEventListener('click', () => {
    if (restoring) return;
    state.track = tab.dataset.resultTab;
    state.task = boundedText(heatmaps.find(map => map.track === state.track)?.search?.value, 160);
    state.scale = charts.find(chart => chart.track === state.track)?.element.dataset.scale || 'full';
    syncMethods(); syncOrder(); writeState();
  }));
  views.forEach(view => view.addEventListener('click', () => {
    if (restoring) return;
    state.view = view.dataset.viewButton; writeState();
  }));
  const openProfileFromHash = () => {
    const current = url();
    if (!current) return;
    let id;
    try {id = decodeURIComponent(current.hash.slice(1));} catch {return;}
    if (!id.startsWith('method-')) return;
    const card = all(root, '[data-method-card]').find(item => item.id === id);
    if (!card) return;
    // Only an explicit profile anchor can relax a conflicting filter. Ordinary
    // filtering never reopens or unhides a card just because its old hash stays.
    let changed = false;
    if (state.family !== 'all' && !(card.dataset.family || '').toLowerCase().includes(state.family)) {
      state.family = 'all';
      if (family) family.value = 'all';
      changed = true;
    }
    const name = normalize(card.dataset.method);
    if (!normalize(state.method).trim().split(/\s+/).filter(Boolean).every(token => name.includes(token))) {
      state.method = '';
      if (methodSearch) methodSearch.value = '';
      changed = true;
    }
    if (changed) {syncMethods(); writeState();}
    if (!card.hidden) card.open = true;
  };
  browser?.addEventListener?.('popstate', () => {restore(readState()); openProfileFromHash();});
  browser?.addEventListener?.('hashchange', () => {restore(readState(true)); openProfileFromHash(); writeState();});
  root.querySelector('[data-reset-board]')?.addEventListener('click', () => {
    heatmaps.forEach(map => {if (map.search) map.search.value = '';});
    restore({...defaults, track: state.track}); writeState();
  });
  const copyStatus = root.querySelector('[data-board-link-status]');
  makeStatus(copyStatus, 'Share current leaderboard view');
  root.querySelector('[data-copy-board-link]')?.addEventListener('click', async () => {
    writeState();
    const current = url();
    if (!current) return;
    try {
      const clipboard = browser?.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(current.href);
      if (copyStatus) copyStatus.textContent = 'Current view link copied.';
    } catch {
      if (!copyStatus) return;
      copyStatus.textContent = 'Copy this link: ';
      const link = document.createElement('span');
      link.textContent = current.href;
      copyStatus.append(link);
      copyStatus.tabIndex = 0;
      copyStatus.focus({preventScroll: true});
      if (document.createRange && browser?.getSelection) {
        const range = document.createRange(); range.selectNodeContents(link);
        const selection = browser.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      }
    }
  });

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
  restore(readState());
  openProfileFromHash();
})();
