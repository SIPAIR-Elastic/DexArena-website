import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {test} from 'node:test';

const root = new URL('../', import.meta.url);
const [navigation, readability, surfaces, behavior, verifier] = await Promise.all([
  'navigation.css', 'readability.css', 'surfaces.css', 'navigation.js', 'verify-navigation.mjs'
].map(name => readFile(new URL(`src/${name}`, root), 'utf8')));

const normalize = value => value.replace(/\s+/g, ' ').replace(/\s*>\s*/g, '>').trim();

// Inspect every authored declaration, including narrow-screen overrides. Browser
// checks complement these source contracts by measuring the resolved cascade.
function rules(source, matches = () => true) {
  return [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([, selectors, body]) => {
      const declarations = Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)]
        .map(([, property, value]) => [property, value.trim()]));
      return selectors.split(/,\s*(?![^()]*\))/).map(normalize)
        .filter(matches).map(selector => ({selector, ...declarations}));
    });
}

function exact(source, selector) {
  return rules(source, value => value === normalize(selector));
}

function ending(source, selector) {
  const suffix = normalize(selector);
  return rules(source, value => value === suffix || value.endsWith(` ${suffix}`) || value.endsWith(`>${suffix}`));
}

function size(rule) {
  const value = rule['font-size'] || rule.font || '';
  return Number(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|\/|$)/.exec(value)?.[1]);
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

test('Refined navigation uses a compact display face without shrinking usable hit areas', () => {
  const desktop = exact(navigation, '.site-nav[data-nav-theme="precision"] .site-nav__desktop .site-nav__link');
  assert(desktop.some(rule => /550\s+15px\/1\.45\s+var\(--display\)/.test(rule.font || '')), 'Desktop destinations use the lighter 15 px display-face hierarchy');
  assert(desktop.filter(rule => Number.isFinite(size(rule))).every(rule => size(rule) === 15), 'No responsive override silently restores the larger desktop type');
  assert(desktop.some(rule => /^(?:inline-)?(?:flex|grid|block)$/.test(rule.display || '') && Number.parseFloat(rule['min-height']) >= 44), 'The smaller text still sits inside a real 44 px interaction box');

  const mobile = exact(navigation, '.site-nav[data-nav-theme="precision"] .site-nav__drawer .site-nav__link');
  assert(mobile.some(rule => /550\s+16px\/1\.6\s+var\(--display\)/.test(rule.font || '')), 'Mobile destinations retain a legible 16 px display face');
  assert(mobile.filter(rule => Number.isFinite(size(rule))).every(rule => size(rule) >= 16), 'Drawer type never falls below 16 px');
  const heights = mobile.map(rule => Number.parseFloat(rule['min-height'])).filter(Number.isFinite);
  assert(heights.includes(52) && heights.includes(48), 'Tablet and phone links preserve their generous targets');
  assert(heights.every(height => height >= 48), 'Compact drawer styling does not sacrifice touch area');

  const search = ending(navigation, '.nav-search');
  assert(search.some(rule => size(rule) === 14 && Number.parseFloat(rule['min-height']) >= 44), 'The 14 px Search label retains a 44 px control');
  assert(search.filter(rule => Number.isFinite(size(rule))).every(rule => size(rule) >= 14), 'Search text stays above the metadata floor');
  assert(ending(navigation, '.menu-toggle').some(rule => Number.parseFloat(rule.width) >= 44 && Number.parseFloat(rule.height) >= 44), 'The menu toggle remains touch-sized');
  assert.match(verifier, /\['Desktop',[\s\S]*?,15\],\['Mobile',[\s\S]*?,16\]/, 'The build verifier adopts the deliberate 15/16 px navigation floors');
});

test('Brand typography steps down coherently while body and metadata scales remain intact', () => {
  const brand = ending(navigation, '.wordmark__type b');
  assert(brand.some(rule => /600\s+21px\//.test(rule.font || '')), 'The desktop wordmark uses a restrained 21 px semibold face');
  assert(brand.some(rule => rule['font-size'] === '20px'), 'Narrow screens step the wordmark down to 20 px');
  const descriptor = ending(navigation, '.wordmark__type small');
  assert(descriptor.some(rule => size(rule) === 14), 'The descriptor remains readable at 14 px');
  assert(descriptor.filter(rule => rule['text-transform']).every(rule => rule['text-transform'] === 'none'), 'The descriptor no longer creates a dense uppercase strip');
  assert(ending(navigation, '.wordmark__type').some(rule => rule.gap === '2px'), 'The two-line identity uses a tighter, intentional baseline gap');

  const body = exact(readability, ':root');
  assert.equal(body[0]['--type-body'], '18px', 'This header-only refinement does not reduce explanatory prose');
  assert.equal(body[0]['--type-small'], '16px', 'Normal controls retain their full-size scale');
  assert.equal(body[0]['--type-meta'], '14px', 'The general metadata minimum remains unchanged');
  assert(body.some(rule => rule['--type-body'] === '17px'), 'Phone prose remains at 17 px');

  const stale = rules(readability, selector => /\.site-nav__desktop[^{}]*\.site-nav__link|\.nav-search$|\.nav-drawer-footer$|\.wordmark__type$/.test(selector));
  assert(!stale.some(rule => rule.font || rule['font-size'] || rule.gap), 'The last-loaded readability layer cannot restore the old large header text or brand spacing');
  assert(ending(navigation, '.nav-drawer-footer').filter(rule => Number.isFinite(size(rule))).every(rule => size(rule) >= 14), 'Drawer supporting copy remains at least 14 px');
});

test('The slim glass dock preserves the shared corner scale and keeps desktop destinations unboxed', () => {
  const dock = ending(navigation, '.site-nav__pill');
  assert(dock.some(rule => rule.width === 'min(1240px,100%)' || rule.width === 'min(1240px, 100%)'), 'The desktop dock has the new balanced maximum width');
  assert(dock.some(rule => rule['min-height'] === '68px'), 'The standard dock uses the restrained 68 px height');
  assert(dock.some(rule => rule.selector.includes('.is-scrolled') && rule['min-height'] === '64px'), 'The scrolled dock compacts gently');
  assert(dock.filter(rule => rule['border-radius']).every(rule => rule['border-radius'] === 'var(--radius-dock)'), 'The recent softer corners are preserved at every breakpoint');
  assert(dock.some(rule => /blur\(/.test(rule['backdrop-filter'] || '')), 'A quiet glass surface retains depth without an opaque link tray');
  assert(exact(surfaces, ':root').some(rule => rule['--radius-dock'] === '30px'), 'The desktop shared dock radius remains 30 px');
  assert(exact(surfaces, ':root').some(rule => rule['--radius-dock'] === '24px'), 'The narrow shared dock radius remains 24 px');

  const destinations = rules(navigation, selector => selector.includes('.site-nav__desktop') && /\.site-nav__link(?::[\w-]+|\.is-active)?$/.test(selector));
  assert(destinations.some(rule => rule.background === 'none'), 'The default desktop links remain plain text destinations');
  for (const rule of destinations) {
    for (const property of ['background', 'background-color', 'background-image']) {
      if (rule[property]) assert(/^(?:none|transparent)$/.test(rule[property]), `${rule.selector}: no default, hovered, focused or current link background box`);
    }
    if (rule['box-shadow']) assert.equal(rule['box-shadow'], 'none', `${rule.selector}: no shadow-backed destination tile`);
  }
  assert(ending(navigation, '.wordmark__mark').filter(rule => rule['border-radius']).every(rule => rule['border-radius'] === '0'), 'The hand artwork remains free-standing');
});

test('Decorative accents do not intercept interaction and motion honors visitor preferences', () => {
  const accent = rules(navigation, selector => /\.site-nav__pill:{1,2}(?:before|after)$/.test(selector));
  assert(accent.some(rule => rule['pointer-events'] === 'none' && rule.content), 'The dock edge highlight is decorative and click-through');
  assert(ending(navigation, '.nav-indicator').some(rule => rule['pointer-events'] === 'none'), 'The animated route line cannot block link clicks');
  assert(ending(navigation, '.nav-indicator:after').some(rule => rule['box-shadow'] && Number.parseFloat(rule.height) <= 2), 'The active route uses a fine line with a soft glow rather than a large box');
  assert.match(navigation, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)[\s\S]*?animation\s*:\s*none!important[\s\S]*?transition\s*:\s*none!important/, 'Reduced-motion visitors receive no decorative arrival or hover animation');
  assert.match(navigation, /:focus-visible\s*\{[^}]*outline\s*:\s*2px[^}]*outline-offset\s*:\s*3px/, 'Keyboard focus retains its visible, offset outline');
});

test('The compact drawer stays bounded, scrollable and keyboard-dismissible', () => {
  const drawer = ending(navigation, '.site-nav__drawer');
  assert(drawer.some(rule => /100dvh/.test(rule['max-height'] || '') && /^(?:auto|scroll)$/.test(rule.overflow || rule['overflow-y'] || '')), 'A short viewport can scroll every destination without clipping');
  assert(drawer.filter(rule => rule['border-radius']).every(rule => rule['border-radius'] === 'var(--radius-dock)'), 'Drawer corners follow the same responsive radius scale');
  assert(drawer.some(rule => rule['pointer-events'] === 'none'), 'Closed navigation cannot capture clicks');
  assert(ending(navigation, '.site-nav__drawer.open').some(rule => rule['pointer-events'] === 'auto'), 'Open navigation restores interaction');
  for (const hook of ['dexarena:close-navigation', 'Escape', 'aria-expanded', 'aria-hidden', 'inert', 'ResizeObserver']) assert(behavior.includes(hook), `Navigation preserves the ${hook} behavior contract`);
  assert.match(behavior, /\.focus\s*\(/, 'The drawer still manages opening and restored keyboard focus');
});

test('Every generated shell receives the same refined navigation asset before the readability layer', async () => {
  assert.equal(await readFile(new URL('dist/assets/navigation.css', root), 'utf8'), navigation, 'Deployment uses the authored navigation styles verbatim');
  assert.equal(await readFile(new URL('dist/assets/navigation.js', root), 'utf8'), behavior, 'The tested navigation behavior is copied verbatim');
  let checked = 0;
  for (const path of await htmlFiles('dist')) {
    const html = await readFile(new URL(path, root), 'utf8');
    if (html.includes('data-paper-redirect')) continue;
    const sheets = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([, href]) => href);
    assert.equal(sheets.filter(href => /\/assets\/navigation\.css(?:\?|$)/.test(href)).length, 1, `${path}: a single shared navigation layer`);
    assert.match(sheets.at(-2), /\/assets\/navigation\.css(?:\?|$)/, `${path}: component styling retains its position`);
    assert.match(sheets.at(-1), /\/assets\/readability\.css(?:\?|$)/, `${path}: the global readable text layer stays last`);
    checked++;
  }
  assert(checked >= 34, 'The refinement reaches nested task pages and unpublished-document notices, not just the homepage');
});
