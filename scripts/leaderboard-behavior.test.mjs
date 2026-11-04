import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/leaderboard.js', import.meta.url), 'utf8');
const dataKey = name => name.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// A deliberately small, dependency-free DOM for executing the production
// browser script. It models hidden ancestors rather than layout/offset sizes.
class Element {
  constructor({data = {}, classes = [], text = ''} = {}) {
    this.dataset = {...data};
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.hidden = false;
    this.tabIndex = -1;
    this.textContent = text;
    this.value = '';
    this.style = {setProperty(name, value) {this[name] = value;}};
    const names = new Set(classes);
    this.classList = {
      contains: name => names.has(name),
      toggle(name, force) {
        const on = force === undefined ? !names.has(name) : force;
        if (on) names.add(name); else names.delete(name);
        return on;
      }
    };
  }
  append(...elements) {
    for (const element of elements) this.insertBefore(element, null);
    return elements.at(-1);
  }
  insertBefore(element, before) {
    if (element === before) return element;
    if (element.parentElement) {
      const siblings = element.parentElement.children;
      siblings.splice(siblings.indexOf(element), 1);
    }
    const index = before ? this.children.indexOf(before) : this.children.length;
    element.parentElement = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, element);
    return element;
  }
  get nextSibling() {
    const siblings = this.parentElement?.children || [];
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  get textContent() {return (this._text || '') + this.children.map(child => child.textContent).join('');}
  set textContent(value) {
    this._text = String(value);
    for (const child of this.children || []) child.parentElement = null;
    this.children = [];
  }
  matches(selector) {
    if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
    const attributes = [...selector.matchAll(/\[([^\]=]+)(?:=['"]?([^\]'"=]+)['"]?)?\]/g)];
    return classes.every(name => this.classList.contains(name)) && attributes.every(([, name, value]) => {
      const actual = name.startsWith('data-') ? this.dataset[dataKey(name)] : this.attributes[name];
      return actual !== undefined && (value === undefined || String(actual) === value);
    });
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  setAttribute(name, value) {this.attributes[name] = String(value);}
  getAttribute(name) {return this.attributes[name] ?? null;}
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, properties = {}) {
    const event = {target: this, defaultPrevented: false, preventDefault() {this.defaultPrevented = true;}, ...properties};
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  click() {this.clickCount = (this.clickCount || 0) + 1; this.dispatch('click');}
  focus() {Element.activeElement = this; this.dispatch('focus');}
}

const element = (data = {}, extra = {}) => new Element({data, ...extra});
const families = ['demo-guided rl', 'demo-guided rl', 'imitation learning', 'imitation learning', 'vla', 'vla'];

function fixture({href, clipboard} = {}) {
  Element.activeElement = null;
  const root = element({leaderboardEnhanced: ''});
  const family = root.append(element({methodFilter: ''}));
  family.value = 'all';
  const familyStatus = root.append(element({familyStatus: ''}));
  const methodSearch = root.append(element({methodSearch: ''}));
  const order = root.append(element({rankOrder: ''}));
  order.value = 'score';
  const copy = root.append(element({copyBoardLink: ''}));
  const copyStatus = root.append(element({boardLinkStatus: ''}));
  const reset = root.append(element({resetBoard: ''}));
  const methodEmpty = root.append(element({methodEmpty: ''}));
  const chart = root.append(element({rankingChart: '', fullScale: '100', detailScale: '2'}));
  const full = chart.append(element({chartScale: 'full'}));
  const detailScale = chart.append(element({chartScale: 'detail'}));
  const ticks = Array.from({length: 5}, () => chart.append(element({axisTick: ''})));
  const means = [0, 0.4, 1.6, 2.4, 49.2, 61.4];
  const chartRows = means.map((mean, index) => {
    const row = chart.append(element({visualMethod: '', method: `Method ${index}`, rank: String(6 - index), mean: String(mean), std: '0.3', family: families[index]}, {classes: ['chart-row']}));
    row.append(element({}, {classes: ['chart-bar']}), element({}, {classes: ['chart-whisker']}));
    return row;
  });
  const scaleNote = chart.append(element({scaleNote: ''}));
  const panel = root.append(element({resultPanel: 'stage'}));
  // A presentation mode hidden by the existing site controller must not cause
  // the enhancement to steal focus or erase its own roving-grid state.
  panel.hidden = true;
  const map = panel.append(element({heatmap: '', rowLabel: 'stages'}));
  const search = map.append(element({heatSearch: ''}));
  const count = map.append(element({heatCount: ''}));
  const empty = map.append(element({heatEmpty: ''}));
  const table = map.append(element({}, {classes: ['heatmap-table']}));
  const headers = families.map((family, index) => table.append(element({methodColumn: '', method: `Method ${index}`, family})));
  const groups = Array.from({length: 2}, () => table.append(element({taskGroup: ''})));
  const groupHeadings = groups.map(group => group.append(element({groupHeading: ''})));
  const rows = [];
  const cells = [];
  for (let row = 0; row < 4; row++) {
    const group = groups[Math.floor(row / 2)];
    const heatRow = group.append(element({heatRow: '', searchText: `Widget task ${Math.floor(row / 2)} Stage ${row}`}));
    rows.push(heatRow);
    for (let col = 0; col < 6; col++) {
      const column = heatRow.append(element({methodColumn: '', method: `Method ${col}`, family: families[col]}));
      cells.push(column.append(element({
        heatCell: '', row: String(row), col: String(col), mean: String(row * 10 + col),
        method: `Method ${col}`, task: `Widget ${Math.floor(row / 2)}`, stage: `Stage ${row}`,
        ...(row === 1 ? {std: '2.3'} : {})
      })));
    }
  }
  const detail = map.append(element({heatDetail: ''}));
  const fields = Object.fromEntries(['Method', 'Task', 'Stage', 'Value', 'Uncertainty'].map(name => [name.toLowerCase(), detail.append(element({[`detail${name}`]: ''}))]));
  const fullTable = root.append(element({}, {classes: ['results-table']}));
  const fullTableColumns = families.map((family, index) => fullTable.append(element({methodColumn: '', method: `Method ${index}`, family})));
  const cards = families.map((family, index) => {
    const card = root.append(element({methodCard: '', method: `Method ${index}`, family}));
    card.id = `method-${index}`;
    return card;
  });
  const tabs = ['stage', 'generalization', 'longHorizon'].map(resultTab => root.append(element({resultTab})));
  const views = ['charts', 'heatmap', 'tables'].map(viewButton => root.append(element({viewButton})));
  const tracks = new Map();
  let browser;
  const historyCalls = [], clipboardCalls = [], selections = [];
  if (href) {
    panel.insertBefore(chart, map);
    const firstDistribution = panel.append(element());
    const firstDistributionHeading = firstDistribution.append(element({}, {text: 'Distribution heading'}));
    const distributionRows = means.map((mean, index) => firstDistribution.append(element({visualMethod: '', method: `Method ${index}`, family: families[index], mean: String(mean)}, {classes: ['distribution-row']})));
    const firstDistributionNote = firstDistribution.append(element({}, {text: 'Distribution note'}));
    const rankingBody = panel.append(element());
    const rankingRows = means.map((mean, index) => rankingBody.append(element({methodRow: '', method: `Method ${index}`, family: families[index], mean: String(mean), rank: String(6 - index)})));
    tracks.set('stage', {panel, chart, chartRows, distributionRows, rankingRows, rankingBody, firstDistribution, firstDistributionHeading, firstDistributionNote});
    for (const [id, means] of [['generalization', [2, 4, 6, 8, 10, 12]], ['longHorizon', [0, 0.2, 0.4, 0.6, 1.2, 1.6]]]) {
      const trackPanel = root.append(element({resultPanel: id}));
      const chart = trackPanel.append(element({rankingChart: '', fullScale: '100', detailScale: '2'}));
      if (id === 'longHorizon') chart.append(element({chartScale: 'full'}), element({chartScale: 'detail'}));
      Array.from({length: 5}, () => chart.append(element({axisTick: ''})));
      const chartRows = means.map((mean, index) => {
        const row = chart.append(element({visualMethod: '', method: `Method ${index}`, mean: String(mean), family: families[index]}, {classes: ['chart-row']}));
        row.append(element({}, {classes: ['chart-bar']}));
        return row;
      });
      chart.append(element({scaleNote: ''}));
      const distribution = trackPanel.append(element());
      const distributionRows = means.map((mean, index) => distribution.append(element({visualMethod: '', method: `Method ${index}`, family: families[index], mean: String(mean)}, {classes: ['distribution-row']})));
      const rankingBody = trackPanel.append(element());
      const rankingRows = means.map((mean, index) => rankingBody.append(element({methodRow: '', method: `Method ${index}`, family: families[index], mean: String(mean), rank: String(6 - index)})));
      tracks.set(id, {panel: trackPanel, chart, chartRows, distributionRows, rankingRows, rankingBody});
    }
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(item => item.setAttribute('aria-pressed', String(item === tab)));
      tracks.forEach(track => track.panel.hidden = track.panel.dataset.resultPanel !== tab.dataset.resultTab);
    }));
    views.forEach(view => view.addEventListener('click', () => views.forEach(item => item.setAttribute('aria-pressed', String(item === view)))));
    const listeners = new Map();
    browser = {
      location: {href},
      navigator: {clipboard: clipboard === false ? undefined : {async writeText(value) {clipboardCalls.push(value); if (clipboard === 'reject') throw new Error('Denied');}}},
      history: {state: {retained: true}, replaceState(state, title, next) {historyCalls.push(next); browser.location.href = next;}},
      addEventListener(type, listener) {if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener);},
      dispatch(type) {for (const listener of listeners.get(type) || []) listener();},
      getSelection() {return {removeAllRanges() {}, addRange(range) {selections.push(range);}};}
    };
  }
  const document = {
    querySelector(selector) {return root.matches(selector) ? root : null;},
    createElement() {return element();},
    createRange() {return {selectNodeContents(target) {this.target = target;}};}
  };
  vm.runInNewContext(source, {document, ...(browser ? {window: browser, URL} : {})});
  return {root, family, familyStatus, chart, chartRows, full, detailScale, ticks, scaleNote, map, search, count, empty, table, fullTable, groups, groupHeadings, headers, fullTableColumns, rows, cells, fields, detail, tabs, views, methodSearch, order, copy, copyStatus, reset, methodEmpty, cards, browser, historyCalls, clipboardCalls, selections, tracks};
}

test('Leaderboard enhancement is inert on every other website page', () => {
  assert.doesNotThrow(() => vm.runInNewContext(source, {document: {querySelector() {return null;}}}));
});

test('Chart zoom changes only the explicit display scale, with exact zero and bounded uncertainty', () => {
  const {chart, chartRows, full, detailScale, ticks, scaleNote} = fixture();
  assert.deepEqual(ticks.map(tick => tick.textContent), ['0', '25', '50', '75', '100']);
  assert.equal(chartRows[0].querySelector('.chart-bar').style.width, '0%');
  assert.equal(chartRows[0].querySelector('.chart-bar').style.minWidth, undefined);
  detailScale.click();
  assert.equal(chart.dataset.scale, 'detail');
  assert.equal(detailScale.getAttribute('aria-pressed'), 'true');
  assert.equal(full.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(ticks.map(tick => tick.textContent), ['0', '0.5', '1', '1.5', '2']);
  assert.equal(chartRows[1].querySelector('.chart-bar').style.width, '20%');
  assert.equal(chartRows[3].querySelector('.chart-bar').style.width, '100%');
  assert(Math.abs(Number.parseFloat(chartRows[1].querySelector('.chart-whisker').style.left) - 5) < 1e-9);
  assert(Math.abs(Number.parseFloat(chartRows[1].querySelector('.chart-whisker').style.width) - 30) < 1e-9);
  assert.equal(chartRows[5].dataset.mean, '61.4', 'Display zoom never changes measured data');
  assert.match(scaleNote.textContent, /0–2%.*unchanged/);
  full.click();
  assert.equal(chart.dataset.scale, 'full');
  assert.equal(chartRows[5].querySelector('.chart-bar').style.width, '61.4%');
  assert.equal(scaleNote.getAttribute('aria-live'), 'polite');
});

test('Heatmap selection exposes persistent exact values without stealing initial focus or injecting HTML', () => {
  const {cells, fields, count, detail} = fixture();
  assert.equal(Element.activeElement, null);
  assert.equal(cells.filter(cell => cell.tabIndex === 0).length, 1);
  assert.equal(cells[0].tabIndex, 0);
  assert.equal(count.textContent, '4 of 4 stages');
  assert.equal(fields.value.textContent, '0.0%');
  cells[6].dataset.method = '<img onerror=unexpected()> — π0.5';
  cells[6].dispatch('mouseenter');
  assert.equal(fields.method.textContent, '<img onerror=unexpected()> — π0.5');
  assert.equal(fields.value.textContent, '10.0%');
  assert.equal(fields.uncertainty.textContent, '± 2.3 percentage points · scene standard deviation');
  assert(cells[6].classList.contains('is-selected'));
  assert.equal(cells.filter(cell => cell.tabIndex === 0).length, 1);
  assert.equal(detail.getAttribute('role'), 'status');
  assert.equal(detail.getAttribute('aria-atomic'), 'true');
});

test('Method-family filtering updates every matrix column, group width and keyboard target', () => {
  const {family, familyStatus, cells, headers, fullTableColumns, fullTable, groupHeadings, table, fields} = fixture();
  cells[1].click();
  family.value = 'vla';
  family.dispatch('change');
  assert.equal(familyStatus.textContent, '2 of 6 methods');
  assert.deepEqual(headers.map(header => header.hidden), [true, true, true, true, false, false]);
  assert.deepEqual(fullTableColumns.map(column => column.hidden), [true, true, true, true, false, false]);
  assert(groupHeadings.every(heading => heading.colSpan === 3));
  assert.equal(table.style['--visible-methods'], '2');
  assert.equal(fullTable.style['--visible-methods'], '2');
  assert.equal(cells[4].tabIndex, 0, 'A removed selection transfers to the first visible method');
  assert.equal(fields.method.textContent, 'Method 4');
  cells[4].dispatch('keydown', {key: 'ArrowRight'});
  assert.equal(Element.activeElement, cells[5]);
  cells[5].dispatch('keydown', {key: 'ArrowDown'});
  assert.equal(Element.activeElement, cells[11]);
  cells[11].dispatch('keydown', {key: 'Home'});
  assert.equal(Element.activeElement, cells[10]);
  cells[10].dispatch('keydown', {key: 'End', ctrlKey: true});
  assert.equal(Element.activeElement, cells[23]);
  assert.equal(cells.filter(cell => cell.tabIndex === 0).length, 1);
  family.value = 'all'; family.dispatch('change');
  assert.equal(familyStatus.textContent, '6 of 6 methods');
  assert(headers.every(header => !header.hidden));
  assert(groupHeadings.every(heading => heading.colSpan === 7));
});

test('Stage search hides empty task groups, announces counts and restores a valid focus target', () => {
  const {search, count, rows, groups, empty, cells, fields} = fixture();
  search.value = 'WIDGET   stage 3'; search.dispatch('input');
  assert.deepEqual(rows.map(row => row.hidden), [true, true, true, false]);
  assert.deepEqual(groups.map(group => group.hidden), [true, false]);
  assert.equal(count.textContent, '1 of 4 stages');
  assert.equal(empty.hidden, true);
  assert.equal(cells[18].tabIndex, 0);
  search.value = 'not a task'; search.dispatch('input');
  assert.equal(count.textContent, '0 of 4 stages');
  assert.equal(empty.hidden, false);
  assert.equal(cells.filter(cell => cell.tabIndex === 0).length, 0);
  assert.equal(fields.method.textContent, 'No matching result');
  assert.equal(fields.value.textContent, '—');
  search.value = ''; search.dispatch('input');
  assert.equal(count.textContent, '4 of 4 stages');
  assert.equal(cells[0].tabIndex, 0);
  assert(groups.every(group => !group.hidden));
});

test('Result and presentation button groups support keyboard navigation without a second selection controller', () => {
  const {tabs, views} = fixture();
  tabs[0].dispatch('keydown', {key: 'ArrowLeft'});
  assert.equal(Element.activeElement, tabs[2]);
  assert.equal(tabs[2].clickCount, 1);
  tabs[2].dispatch('keydown', {key: 'Home'});
  assert.equal(Element.activeElement, tabs[0]);
  views[0].dispatch('keydown', {key: 'End'});
  assert.equal(Element.activeElement, views[2]);
  views[2].dispatch('keydown', {key: 'ArrowRight'});
  assert.equal(Element.activeElement, views[0]);
  assert.equal(tabs[0].getAttribute('role'), null, 'Pressed-state buttons are not relabeled as ARIA tabs');
  assert.equal(views[0].dispatch('keydown', {key: 'Tab'}).defaultPrevented, false);
});

test('A shared URL restores bounded controls, the authoritative track/view and detail scale without focus or navigation', () => {
  const f = fixture({href: 'https://sipair-elastic.github.io/DexArena-website/leaderboard/?v=release-123&unknown=keep&track=longHorizon&view=heatmap&family=vla&method=Method%205&order=name&scale=detail#lb-results'});
  assert.equal(f.tabs[2].getAttribute('aria-pressed'), 'true');
  assert.equal(f.views[1].getAttribute('aria-pressed'), 'true');
  assert.equal(f.family.value, 'vla');
  assert.equal(f.methodSearch.value, 'Method 5');
  assert.equal(f.order.value, 'name');
  assert.equal(f.familyStatus.textContent, '1 of 6 methods');
  assert.deepEqual(f.cards.map(card => card.hidden), [true, true, true, true, true, false]);
  assert.equal(f.tracks.get('longHorizon').chart.dataset.scale, 'detail');
  assert.equal(f.tracks.get('longHorizon').chartRows[5].querySelector('.chart-bar').style.width, '80%');
  assert.equal(f.tracks.get('stage').panel.hidden, true);
  assert.equal(Element.activeElement, null);
  assert.equal(f.historyCalls.length, 0, 'Restoring a URL never writes a new history entry or reloads the page');

  const tasks = fixture({href: 'https://example.test/DexArena-website/leaderboard/?track=stage&view=heatmap&task=Stage%203'});
  assert.equal(tasks.search.value, 'Stage 3');
  assert.equal(tasks.count.textContent, '1 of 4 stages');
  assert.equal(tasks.cells[18].tabIndex, 0);

  const legacy = fixture({href: 'https://example.test/DexArena-website/leaderboard/?v=kept#results-longHorizon'});
  assert.equal(legacy.tabs[2].getAttribute('aria-pressed'), 'true');
  assert.equal(legacy.historyCalls.length, 0);

  const invalid = fixture({href: `https://example.test/DexArena-website/leaderboard/?track=bad&view=bad&family=bad&order=bad&scale=detail&method=${'a'.repeat(200)}&task=${'b'.repeat(200)}#lb-updates`});
  assert.equal(invalid.tabs[0].getAttribute('aria-pressed'), 'true');
  assert.equal(invalid.views[0].getAttribute('aria-pressed'), 'true');
  assert.equal(invalid.family.value, 'all');
  assert.equal(invalid.order.value, 'score');
  assert.equal(invalid.chart.dataset.scale, 'full');
  assert.equal(invalid.methodSearch.value.length, 120);
  assert.equal(invalid.search.value.length, 160);
});

test('Combined method search and family filtering affect every presentation without misreporting missing tasks', () => {
  const f = fixture({href: 'https://example.test/DexArena-website/leaderboard/?v=kept&utm_source=lab#lb-methods'});
  f.methodSearch.value = 'Method 5'; f.methodSearch.dispatch('input');
  assert.equal(f.familyStatus.textContent, '1 of 6 methods');
  for (const track of f.tracks.values()) {
    assert.deepEqual(track.chartRows.map(row => row.hidden), [true, true, true, true, true, false]);
    assert.deepEqual(track.distributionRows.map(row => row.hidden), [true, true, true, true, true, false]);
    assert.deepEqual(track.rankingRows.map(row => row.hidden), [true, true, true, true, true, false]);
  }
  assert.deepEqual(f.headers.map(header => header.hidden), [true, true, true, true, true, false]);
  assert.deepEqual(f.fullTableColumns.map(column => column.hidden), [true, true, true, true, true, false]);
  let current = new URL(f.browser.location.href);
  assert.equal(current.pathname, '/DexArena-website/leaderboard/');
  assert.equal(current.searchParams.get('v'), 'kept');
  assert.equal(current.searchParams.get('utm_source'), 'lab');
  assert.equal(current.searchParams.get('method'), 'Method 5');
  assert.equal(current.hash, '#lb-methods');
  f.family.value = 'rl'; f.family.dispatch('change');
  assert.equal(f.familyStatus.textContent, '0 of 6 methods');
  assert.equal(f.methodEmpty.hidden, false);
  assert.equal(f.empty.hidden, false);
  assert.match(f.empty.textContent, /No matching methods/);
  assert.doesNotMatch(f.empty.textContent, /No matching tasks/);
  assert.equal(f.count.textContent, '4 of 4 stages');
  assert.equal(f.cells.filter(cell => cell.tabIndex === 0).length, 0);
  f.family.value = 'all'; f.family.dispatch('change');
  assert.equal(f.methodEmpty.hidden, true);
  assert.equal(f.cells[5].tabIndex, 0);
  f.search.value = 'Stage 3'; f.search.dispatch('input');
  current = new URL(f.browser.location.href);
  assert.equal(current.searchParams.get('task'), 'Stage 3');
  assert.equal(f.count.textContent, '1 of 4 stages');
});

test('Name and score ordering move only current-track comparison rows, preserving global ranks and fixed method columns', () => {
  const f = fixture({href: 'https://example.test/DexArena-website/leaderboard/'});
  const stage = f.tracks.get('stage'), generalization = f.tracks.get('generalization');
  const names = rows => rows.map(row => row.dataset.method);
  const rendered = (track, selector) => names(track.panel.querySelectorAll(selector));
  const ranks = stage.rankingRows.map(row => row.dataset.rank);
  const untouchedGeneralization = rendered(generalization, '.chart-row');
  f.order.value = 'name'; f.order.dispatch('change');
  const ascending = Array.from({length: 6}, (_, index) => `Method ${index}`);
  assert.deepEqual(rendered(stage, '.chart-row'), ascending);
  assert.deepEqual(rendered(stage, '.distribution-row'), ascending);
  assert.deepEqual(rendered(stage, '[data-method-row]'), ascending);
  assert.deepEqual(rendered(generalization, '.chart-row'), untouchedGeneralization, 'Inactive tracks are not reordered');
  assert.deepEqual(stage.rankingRows.map(row => row.dataset.rank), ranks, 'Global rank labels are never recomputed from filters or sorting');
  assert.equal(stage.firstDistribution.children[0], stage.firstDistributionHeading);
  assert.equal(stage.firstDistribution.children.at(-1), stage.firstDistributionNote);
  f.order.value = 'score'; f.order.dispatch('change');
  assert.deepEqual(rendered(stage, '.chart-row'), [...ascending].reverse());
  assert.deepEqual(rendered(stage, '.distribution-row'), [...ascending].reverse());
  assert.deepEqual(rendered(stage, '[data-method-row]'), [...ascending].reverse());
  assert.deepEqual(names(f.headers), ascending, 'Matrix method columns never reorder');
  assert.equal(new URL(f.browser.location.href).searchParams.get('order'), 'score');
});

test('Browser history and legacy result anchors restore current controls without loops, focus theft or stale results', () => {
  const f = fixture({href: 'https://example.test/DexArena-website/leaderboard/?v=release&foo=bar#lb-results'});
  f.browser.location.href = 'https://example.test/DexArena-website/leaderboard/?v=release&foo=bar&track=generalization&view=tables&family=imitation&method=Method%203&order=name#lb-results';
  f.browser.dispatch('popstate');
  assert.equal(f.tabs[1].getAttribute('aria-pressed'), 'true');
  assert.equal(f.views[2].getAttribute('aria-pressed'), 'true');
  assert.equal(f.family.value, 'imitation');
  assert.equal(f.methodSearch.value, 'Method 3');
  assert.equal(f.familyStatus.textContent, '1 of 6 methods');
  assert.equal(f.historyCalls.length, 0);
  assert.equal(Element.activeElement, null);
  f.browser.location.href = f.browser.location.href.replace('#lb-results', '#results-stage');
  f.browser.dispatch('hashchange');
  assert.equal(f.tabs[0].getAttribute('aria-pressed'), 'true');
  assert.equal(new URL(f.browser.location.href).searchParams.get('track'), 'stage');
  assert.equal(f.historyCalls.length, 1);
  f.tabs[2].click();
  const current = new URL(f.browser.location.href);
  assert.equal(current.searchParams.get('track'), 'longHorizon');
  assert.equal(current.hash, '#results-longHorizon');
  assert.equal(current.searchParams.get('v'), 'release');
  assert.equal(current.searchParams.get('foo'), 'bar');
  assert.equal(f.tracks.get('longHorizon').panel.hidden, false);
  assert.equal(f.tracks.get('stage').panel.hidden, true);
});

test('Reset retains the evaluation track while clearing searches and restoring the full-scale default view', () => {
  const f = fixture({href: 'https://example.test/DexArena-website/leaderboard/?v=release&keep=yes&track=longHorizon&view=tables&family=vla&method=Method%205&order=name&scale=detail&task=unused#results-longHorizon'});
  f.reset.click();
  assert.equal(f.tabs[2].getAttribute('aria-pressed'), 'true');
  assert.equal(f.views[0].getAttribute('aria-pressed'), 'true');
  assert.equal(f.family.value, 'all');
  assert.equal(f.methodSearch.value, '');
  assert.equal(f.search.value, '');
  assert.equal(f.order.value, 'score');
  assert.equal(f.tracks.get('longHorizon').chart.dataset.scale, 'full');
  assert.equal(f.tracks.get('longHorizon').chartRows[5].querySelector('.chart-bar').style.width, '1.6%');
  assert.equal(f.familyStatus.textContent, '6 of 6 methods');
  const current = new URL(f.browser.location.href);
  assert.equal(current.searchParams.get('track'), 'longHorizon');
  assert.equal(current.searchParams.get('view'), 'charts');
  assert.equal(current.searchParams.has('method'), false);
  assert.equal(current.searchParams.has('task'), false);
  assert.equal(current.searchParams.get('v'), 'release');
  assert.equal(current.searchParams.get('keep'), 'yes');
  assert.equal(Element.activeElement, null);
});

test('Copy current view shares the complete URL and has a selectable, prompt-free clipboard fallback', async () => {
  const f = fixture({href: 'https://example.test/DexArena-website/leaderboard/?v=release&track=longHorizon&view=tables&family=vla&order=name&scale=detail#lb-results'});
  f.copy.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.clipboardCalls.length, 1);
  const shared = new URL(f.clipboardCalls[0]);
  assert.equal(shared.searchParams.get('v'), 'release');
  assert.equal(shared.searchParams.get('track'), 'longHorizon');
  assert.equal(shared.searchParams.get('view'), 'tables');
  assert.equal(shared.searchParams.get('scale'), 'detail');
  assert.equal(shared.hash, '#lb-results');
  assert.equal(f.copyStatus.textContent, 'Current view link copied.');
  assert.equal(Element.activeElement, null);

  const fallback = fixture({href: 'https://example.test/DexArena-website/leaderboard/?v=kept', clipboard: 'reject'});
  fallback.copy.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(fallback.copyStatus.textContent, /^Copy this link: https:\/\/example\.test\/DexArena-website\/leaderboard\//);
  assert.equal(fallback.copyStatus.tabIndex, 0);
  assert.equal(Element.activeElement, fallback.copyStatus);
  assert.equal(fallback.selections.length, 1);
  assert.equal(fallback.selections[0].target, fallback.copyStatus.children[0]);
  assert.equal(fallback.selections[0].target.textContent, fallback.browser.location.href, 'The selected fallback is the URL alone, without explanatory text');
  assert.equal(fallback.copyStatus.getAttribute('aria-live'), 'polite');
});

test('Explicit method anchors reveal and open the requested profile without focusing or overriding compatible filters', () => {
  const f = fixture({href: 'https://example.test/DexArena-website/leaderboard/?v=release&keep=yes&track=generalization&view=tables&family=rl&method=Method%200&order=name#method-5'});
  assert.equal(f.cards[5].hidden, false);
  assert.equal(f.cards[5].open, true);
  assert.equal(f.family.value, 'all');
  assert.equal(f.methodSearch.value, '');
  assert.equal(f.views[2].getAttribute('aria-pressed'), 'true');
  assert.equal(f.tabs[1].getAttribute('aria-pressed'), 'true');
  assert.equal(Element.activeElement, null);
  const current = new URL(f.browser.location.href);
  assert.equal(current.hash, '#method-5');
  assert.equal(current.searchParams.get('v'), 'release');
  assert.equal(current.searchParams.get('keep'), 'yes');
  assert.equal(current.searchParams.get('family'), 'all');
  assert.equal(current.searchParams.has('method'), false);
  assert.equal(f.historyCalls.length, 1);

  const compatible = fixture({href: 'https://example.test/DexArena-website/leaderboard/?family=vla&method=Method%205#method-5'});
  assert.equal(compatible.cards[5].open, true);
  assert.equal(compatible.family.value, 'vla');
  assert.equal(compatible.methodSearch.value, 'Method 5');
  assert.equal(compatible.historyCalls.length, 0, 'Compatible filters and the shared URL remain intact');
  compatible.methodSearch.value = 'Method 0'; compatible.methodSearch.dispatch('input');
  assert.equal(compatible.cards[5].hidden, true, 'Ordinary filtering does not reopen a profile from an old anchor');
  compatible.browser.dispatch('hashchange');
  assert.equal(compatible.cards[5].hidden, false);
  assert.equal(compatible.methodSearch.value, '');
  assert.equal(compatible.family.value, 'vla', 'Only the conflicting search is cleared');
  assert.equal(Element.activeElement, null);
});

test('Method search accepts GR00T and pi0.5 aliases while preserving official method labels', () => {
  const f = fixture({href: 'https://example.test/DexArena-website/leaderboard/'});
  for (const item of f.root.querySelectorAll('[data-method]')) {
    if (item.dataset.method === 'Method 4') item.dataset.method = 'GR00T';
    if (item.dataset.method === 'Method 5') item.dataset.method = 'π0.5';
  }
  for (const query of ['groot', 'GR00T']) {
    f.methodSearch.value = query; f.methodSearch.dispatch('input');
    assert.equal(f.familyStatus.textContent, '1 of 6 methods');
    assert.equal(f.cards[4].hidden, false);
    assert.equal(f.cards[5].hidden, true);
  }
  for (const query of ['pi05', 'pi0.5', 'π0.5', 'PI 0.5']) {
    f.methodSearch.value = query; f.methodSearch.dispatch('input');
    assert.equal(f.familyStatus.textContent, '1 of 6 methods');
    assert.equal(f.cards[5].hidden, false);
    assert.equal(f.cards[4].hidden, true);
    assert.equal(f.cards[5].dataset.method, 'π0.5');
  }
});
