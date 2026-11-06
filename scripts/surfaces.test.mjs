import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {test} from 'node:test';
import {isRedirectRoute} from '../src/publication.mjs';

const root = new URL('../', import.meta.url);
const [css, navigation, carousel, leaderboard, build] = await Promise.all([
  readFile(new URL('src/surfaces.css', root), 'utf8'),
  readFile(new URL('src/navigation.css', root), 'utf8'),
  readFile(new URL('src/carousel.css', root), 'utf8'),
  readFile(new URL('src/leaderboard.css', root), 'utf8'),
  readFile(new URL('src/build.mjs', root), 'utf8')
]);

const normalize = value => value.replace(/\s+/g, ' ').replace(/\s*>\s*/g, '>').trim();

function rules(source, matches = () => true) {
  return [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([, selectors, body]) => {
      const declarations = Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)]
        .map(([, property, value]) => [property, value.trim()]));
      return selectors.split(/,\s*(?![^()]*\))/).map(normalize)
        .filter(matches).map(selector => ({selector, ...declarations}));
    });
}

function ending(source, selector) {
  const suffix = normalize(selector);
  return rules(source, value => value === suffix || value.endsWith(` ${suffix}`) || value.endsWith(`>${suffix}`));
}

async function htmlFiles(directory) {
  const found = [];
  for (const entry of await readdir(new URL(directory + '/', root), {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

test('A shared radius scale keeps hero, dock, panels, cards, insets and controls in proportion', () => {
  const scales = rules(css, selector => selector === ':root');
  assert.equal(scales.length, 2, 'One desktop scale and one deliberate narrow-screen scale');
  const tokens = ['--radius-hero', '--radius-dock', '--radius-panel', '--radius-card', '--radius-inset', '--radius-control'];
  const desktop = [44, 30, 32, 24, 20, 16];
  const mobile = [32, 24, 26, 22, 18, 14];
  for (const [index, expected] of [desktop, mobile].entries()) {
    for (const [tokenIndex, token] of tokens.entries()) assert.equal(scales[index][token], `${expected[tokenIndex]}px`, `${index ? 'Mobile' : 'Desktop'} ${token}`);
    assert(expected[0] > expected[2] && expected[2] > expected[3] && expected[3] > expected[4] && expected[4] > expected[5], 'Nested surfaces step down from hero to panels, cards, insets and controls');
    assert(expected[1] > expected[3], 'The navigation dock has a visibly softer silhouette than an ordinary card');
  }
  assert.match(css, /@media\s*\([^)]*max-width\s*:\s*760px\s*\)/, 'A phone-specific scale retains generous corners without consuming the content area');
});

test('Navigation and carousel use shared tokens in desktop and narrow-screen rules', () => {
  for (const selector of ['.site-nav__pill', '.site-nav__drawer']) {
    const rounded = ending(navigation, selector).filter(rule => rule['border-radius']);
    assert(rounded.length >= 2, `${selector}: desktop and narrow-screen radius declarations`);
    assert(rounded.every(rule => rule['border-radius'] === 'var(--radius-dock)'), `${selector}: every responsive override uses the dock token`);
  }
  for (const selector of ['.nav-search', '.nav-paper', '.menu-toggle']) {
    assert(ending(navigation, selector).some(rule => rule['border-radius'] === 'var(--radius-control)'), `${selector}: navigation controls share the control scale`);
  }
  const hero = ending(carousel, '.cover-card').filter(rule => rule['border-radius']);
  assert(hero.length >= 2, 'Desktop and mobile carousel cards are both checked');
  assert(hero.every(rule => rule['border-radius'] === 'var(--radius-hero)'), 'A responsive override cannot quietly restore sharp hero corners');
  assert(ending(carousel, '.cover-card:after').some(rule => rule['border-radius'] === 'inherit'), 'The hero sheen follows the media outline');
  assert(ending(carousel, '.cover-peek-trigger').some(rule => rule['border-radius'] === 'inherit'), 'The neighboring-slide click target follows the hero silhouette');
});

test('Shared surface rules are scoped and do not blanket-clip content or interactive outlines', () => {
  const authored = rules(css);
  const rounded = authored.filter(rule => rule['border-radius']);
  assert(rounded.length >= 15, 'The shared treatment covers multiple surface families, not only the homepage');
  for (const rule of rounded) {
    assert(/^body(?:[\s.#[:]|$)/.test(rule.selector), `${rule.selector}: surface rules are deliberately body-scoped`);
    assert(!/(?:^|[\s>+~,(])\*(?:$|[\s>+~,.:[)])/u.test(rule.selector), `${rule.selector}: no universal radius override`);
  }
  for (const rule of authored) {
    if (/^(?:html|body|body main|body #main)$/.test(rule.selector)) {
      for (const property of ['overflow', 'overflow-x', 'overflow-y']) assert(!/^(?:hidden|clip)$/.test(rule[property] || ''), `${rule.selector}: no page-wide clipping of focus rings or menus`);
    }
  }
  assert(!rounded.some(rule => /(?:\.wordmark__mark|\.nav-indicator|\.carousel-arrow|\.cover-dots|\.chart-(?:bar|track|whisker)|\.heatmap-table\s+td)\b/.test(rule.selector)), 'The surface layer leaves brand artwork, circular pagination and quantitative chart marks unchanged');
});

test('Connected leaderboard panels round only their outside edges and keep focusable content visible', () => {
  const board = ending(css, '.leaderboard-board');
  assert(board.some(rule => rule['border-radius'] === 'var(--radius-panel)'), 'The results board uses the large-panel silhouette');
  assert(ending(leaderboard, '.leaderboard-board').some(rule => rule.overflow === 'visible'), 'The board does not clip focus rings or interactive chart details');
  const header = ending(css, '.leaderboard-board > .board-filter');
  const footer = ending(css, '.leaderboard-board > .result-source');
  assert(header.some(rule => rule['border-radius'] === 'calc(var(--radius-panel) - 1px) calc(var(--radius-panel) - 1px) 0 0'), 'The connected toolbar rounds its two outside top corners inside the enclosing border');
  assert(footer.some(rule => rule['border-radius'] === '0 0 calc(var(--radius-panel) - 1px) calc(var(--radius-panel) - 1px)'), 'The connected source footer rounds its two outside bottom corners inside the enclosing border');
});

test('Circular controls, unboxed navigation links and the free-standing logo retain their existing treatment', () => {
  assert(ending(carousel, '.carousel-arrow').some(rule => /^(?:50%|9999px)$/.test(rule['border-radius'] || '')), 'Carousel arrows remain circular');
  assert(ending(carousel, '.carousel-playback').some(rule => /^(?:50%|9999px)$/.test(rule['border-radius'] || '')), 'Carousel playback remains circular');
  const brand = ending(navigation, '.wordmark__mark').filter(rule => rule['border-radius']);
  assert(brand.length && brand.every(rule => rule['border-radius'] === '0'), 'The hand logo is not forced into a rounded tile');
  assert(rules(navigation, selector => selector.includes('.site-nav__desktop') && selector.endsWith('.site-nav__link')).some(rule => rule.background === 'none'), 'Desktop destinations remain text links rather than background boxes');
});

test('The shared surface asset is deployed verbatim once in every generated shell before navigation and readability', async () => {
  assert.equal(await readFile(new URL('dist/assets/surfaces.css', root), 'utf8'), css, 'Built surface CSS matches the authored asset');
  assert.match(build, /["']surfaces\.css["']/, 'The builder explicitly copies the shared surface asset');
  const files = await htmlFiles('dist');
  assert(files.length >= 35, 'Public routes, unpublished Docs notices and the legacy redirect are included');
  let checked = 0;
  for (const file of files) {
    const html = await readFile(new URL(file, root), 'utf8');
    if (isRedirectRoute('/'+file.replace(/^dist\//,'').replace(/index\.html$/,''))) continue;
    const sheets = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([, href]) => href);
    assert.equal(sheets.filter(href => /\/assets\/surfaces\.css(?:\?|$)/.test(href)).length, 1, `${file}: one shared surface layer`);
    assert.match(sheets.at(-3), /\/assets\/surfaces\.css(?:\?|$)/, `${file}: surface treatment precedes the final component and readability layers`);
    assert.match(sheets.at(-2), /\/assets\/navigation\.css(?:\?|$)/, `${file}: navigation retains its cascade contract`);
    assert.match(sheets.at(-1), /\/assets\/readability\.css(?:\?|$)/, `${file}: readable text stays the final stylesheet`);
    checked++;
  }
  assert.equal(checked, 32, 'The treatment reaches every styled shell, including nested task routes and hidden Docs notices; compatibility redirects remain unstyled');
});
