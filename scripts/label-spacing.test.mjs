import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {test} from 'node:test';

const root = new URL('../', import.meta.url);
const [css, readability, release] = await Promise.all([
  'src/refinement.css', 'src/readability.css', 'dist/assets/site-release.json'
].map(path => readFile(new URL(path, root), 'utf8')));
const {basePath} = JSON.parse(release);
const normalize = value => value.replace(/\s+/g, ' ').replace(/\s*>\s*/g, '>').trim();

// Retain media-query context so a phone-only rule cannot accidentally satisfy
// the desktop spacing contract (or the other way around).
function rules(source, media = []) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  let cursor = 0;
  while (cursor < clean.length) {
    const open = clean.indexOf('{', cursor);
    if (open === -1) break;
    let close = open + 1;
    let depth = 1;
    for (; close < clean.length && depth; close++) {
      if (clean[close] === '{') depth++;
      if (clean[close] === '}') depth--;
    }
    const selectors = clean.slice(cursor, open).trim();
    const body = clean.slice(open + 1, close - 1);
    if (selectors.startsWith('@media')) found.push(...rules(body, [...media, selectors]));
    else if (!selectors.startsWith('@') && !body.includes('{')) {
      const declarations = Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)]
        .map(([, property, value]) => [property, value.trim()]));
      found.push({selectors: selectors.split(/,\s*(?![^()]*\))/).map(normalize), media, ...declarations});
    }
    cursor = close;
  }
  return found;
}

const authored = rules(css);
const family = ['.paper-authors', '.paper-affiliations', '.paper-metadata>div'];
const coversFamily = rule => family.every(selector => rule.selectors.includes(selector));
const selected = (source, selector) => rules(source).filter(rule => rule.selectors.includes(normalize(selector)));
const gaps = rule => {
  const shorthand = (rule.gap || '').split(/\s+/).filter(Boolean);
  return {
    row: rule['row-gap'] || shorthand[0],
    column: rule['column-gap'] || shorthand[1] || shorthand[0]
  };
};

async function htmlFiles(directory) {
  const found = [];
  for (const entry of await readdir(new URL(directory + '/', root), {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

test('Research labels and their content share a generous, shrinkable desktop grid', () => {
  const grid = authored.find(rule => !rule.media.length && coversFamily(rule) && rule.display === 'grid');
  assert(grid, 'Authors, affiliations and every metadata row use the same grid definition');
  assert.match(grid['grid-template-columns'], /^(?:168px|minmax\(0,\s*168px\))\s+minmax\(0,\s*1fr\)$/, 'A 168px label track and shrinkable content track leave room for full-size headings');
  assert.equal(gaps(grid).column, '32px', 'The label and its content have an explicit 32px gutter');
  assert(Number.parseFloat(gaps(grid).row) >= 12, 'Wrapped labels and content retain at least a 12px row gap');
  for (const rule of authored.filter(rule => rule.selectors.some(selector => family.includes(selector)))) {
    assert(!/\b112px\b/.test(rule['grid-template-columns'] || ''), 'No legacy narrow label track remains in the shared layout');
  }
});

test('Every research row stacks with breathing room on narrow screens', () => {
  const mobile = authored.find(rule => coversFamily(rule) && rule['grid-template-columns'] === '1fr' &&
    rule.media.some(query => /max-width\s*:\s*760px/.test(query)));
  assert(mobile, 'Authors, affiliations and all definition-list rows stack at the existing phone breakpoint');
  assert.equal(gaps(mobile).row, '12px', 'The label remains separated from the content when stacked');
  assert.equal(gaps(mobile).column, '12px', 'The compact layout uses one consistent gap');
});

test('Both sides can shrink and long labels wrap instead of overlapping adjacent content', () => {
  for (const [container, children] of [
    ['.paper-authors', ['h2', 'ol']],
    ['.paper-affiliations', ['h2', 'ol']],
    ['.paper-metadata>div', ['dt', 'dd']]
  ]) {
    for (const child of children) {
      const candidates = authored.filter(rule => rule.selectors.includes(`${container}>*`) || rule.selectors.includes(`${container}>${child}`));
      assert(candidates.some(rule => rule['min-width'] === '0' && rule['max-width'] === '100%'), `${container} > ${child}: the grid child cannot impose an overflowing intrinsic width`);
    }
  }
  for (const selector of ['.paper-identity h2', '.paper-metadata dt']) {
    assert(selected(css, selector).some(rule => rule['white-space'] === 'normal' && rule['overflow-wrap'] === 'anywhere'), `${selector}: long words can wrap within the label track`);
  }
});

test('The spacing correction preserves semantic labels, official links and readable type sizes', async () => {
  const home = await readFile(new URL('dist/index.html', root), 'utf8');
  assert.match(home, /<div class="paper-authors"[^>]*>\s*<h2>Authors<\/h2>\s*<ol\b/, 'Author names remain an ordered list with a real heading');
  assert.match(home, /<div class="paper-affiliations"[^>]*>\s*<h2>Affiliations<\/h2>\s*<ol\b/, 'Institution logos retain their heading and ordered-list semantics');
  assert.match(home, /<dt>Leaderboard<\/dt>\s*<dd>\s*<a href="[^\"]*\/leaderboard\/(?:\?[^\"]*)?">View benchmark results/, 'The reported result link is still a functioning definition-list entry');
  for (const university of ['https://www.sjtu.edu.cn/', 'https://www.tsinghua.edu.cn/']) assert(home.includes(`href="${university}"`), 'University logos still link to their official sites');
  const compact = rules(readability).find(rule => rule.selectors.some(selector => selector.startsWith('body :is(') && selector.includes('.paper-identity h2') && selector.includes('.paper-metadata dt')));
  assert.equal(compact?.['font-size'], 'var(--type-small)', 'The layout fix keeps readable labels rather than shrinking typography');
  const scales = selected(readability, ':root');
  assert(scales.some(rule => rule['--type-small'] === '16px'), 'Compact labels remain 16px');
  assert(scales.some(rule => rule['--type-body'] === '18px'), 'Desktop body copy remains 18px');
  assert(scales.some(rule => rule['--type-body'] === '17px'), 'Narrow-screen body copy remains 17px');
});

test('The corrected shared layout is deployed to every styled shell without changing its cascade', async () => {
  const expected = css.replace(/url\((['"]?)\/(?!\/)/g, (_, quote) => `url(${quote}${basePath}`);
  assert.equal(await readFile(new URL('dist/assets/refinement.css', root), 'utf8'), expected, 'Built CSS preserves every spacing rule after project-path font URL rewriting');
  let checked = 0;
  for (const file of await htmlFiles('dist')) {
    const html = await readFile(new URL(file, root), 'utf8');
    if (html.includes('data-paper-redirect')) continue;
    const sheets = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([, href]) => href);
    assert.equal(sheets.filter(href => /\/assets\/refinement\.css(?:\?|$)/.test(href)).length, 1, `${file}: one shared layout layer`);
    assert.match(sheets.at(-1), /\/assets\/readability\.css(?:\?|$)/, `${file}: full-size text remains the final layer`);
    checked++;
  }
  assert(checked >= 34, 'All styled public and unpublished-preview shells receive the corrected layout');
});
