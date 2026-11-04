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
    for (const element of elements) {element.parentElement = this; this.children.push(element);}
    return elements.at(-1);
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

function fixture() {
  Element.activeElement = null;
  const root = element({leaderboardEnhanced: ''});
  const family = root.append(element({methodFilter: ''}));
  family.value = 'all';
  const familyStatus = root.append(element({familyStatus: ''}));
  const chart = root.append(element({rankingChart: '', fullScale: '100', detailScale: '2'}));
  const full = chart.append(element({chartScale: 'full'}));
  const detailScale = chart.append(element({chartScale: 'detail'}));
  const ticks = Array.from({length: 5}, () => chart.append(element({axisTick: ''})));
  const means = [0, 0.4, 1.6, 2.4, 49.2, 61.4];
  const chartRows = means.map((mean, index) => {
    const row = chart.append(element({mean: String(mean), std: '0.3', family: families[index]}, {classes: ['chart-row']}));
    row.append(element({}, {classes: ['chart-bar']}), element({}, {classes: ['chart-whisker']}));
    return row;
  });
  const scaleNote = chart.append(element({scaleNote: ''}));
  const panel = root.append(element({resultPanel: 'execution'}));
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
      const column = heatRow.append(element({methodColumn: '', family: families[col]}));
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
  const fullTableColumns = families.map(family => fullTable.append(element({methodColumn: '', family})));
  const tabs = ['execution', 'generalization', 'longHorizon'].map(resultTab => root.append(element({resultTab})));
  const views = ['charts', 'heatmap', 'tables'].map(viewButton => root.append(element({viewButton})));
  const document = {querySelector(selector) {return root.matches(selector) ? root : null;}};
  vm.runInNewContext(source, {document});
  return {root, family, familyStatus, chart, chartRows, full, detailScale, ticks, scaleNote, map, search, count, empty, table, fullTable, groups, groupHeadings, headers, fullTableColumns, rows, cells, fields, detail, tabs, views};
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
