import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {test} from 'node:test';
import {isRedirectRoute} from '../src/publication.mjs';

const root = new URL('../', import.meta.url);
const [css, build] = await Promise.all([
  readFile(new URL('src/readability.css', root), 'utf8'),
  readFile(new URL('src/build.mjs', root), 'utf8')
]);

// Semantic type tokens give dense metadata and explanatory paragraphs different
// floors. Browser QA checks the actual cascade across every public route.
function rules(selector) {
  const normalize = value => value.replace(/\s+/g, ' ').replace(/\s*>\s*/g, '>').trim();
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(/,\s*(?![^()]*\))/).some(value => normalize(value) === normalize(selector)))
    .map(([, , body]) => Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)].map(([, property, value]) => [property, value.trim()])));
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

test('Shared readability tokens retain a distinct body, secondary and metadata hierarchy', () => {
  const tokens = rules(':root')[0];
  assert(tokens, 'A single shared type scale exists');
  assert.equal(tokens['--type-body'], '18px', 'Desktop explanatory prose uses an 18px foundation');
  assert.equal(tokens['--type-small'], '16px', 'Compact descriptions and controls remain full-sized');
  assert.equal(tokens['--type-meta'], '14px', 'Metadata never returns to tiny label typography');
  const body = rules(':root').map(rule => rule['--type-body']).filter(Boolean);
  assert(body.includes('17px'), 'Narrow screens retain at least a 17px prose foundation');
  assert(body.every(value => Number.parseFloat(value) >= 17), 'No responsive body override shrinks below 17px');
  for (const property of ['--type-small', '--type-meta']) {
    const minimum = property === '--type-small' ? 16 : 14;
    for (const rule of rules(':root')) {
      if (rule[property]) assert(Number.parseFloat(rule[property]) >= minimum, `${property}: responsive floor`);
    }
  }
  assert.match(css, /@media\s*\([^)]*max-width\s*:\s*760px\s*\)/, 'A deliberate narrow-screen scale accompanies the desktop typography');
});

test('Overview prose and the reported benchmark-design paragraph adopt the body scale', async () => {
  const overview = rules('.overview-prose p');
  assert(overview.some(rule => rule['font-size'] === 'var(--type-body)'), 'Overview explanations use the same full-size body token as the rest of the site');
  assert(overview.every(rule => !rule['font-size'] || rule['font-size'] === 'var(--type-body)'), 'A narrow override cannot quietly restore the old 14px overview copy');
  assert(rules('body main p:not(.cover-title):not(.page-subtitle)').some(rule => rule['font-size'] === 'var(--type-body)'), 'Explanatory paragraphs receive the body scale rather than relying on an inherited metadata size');
  const home = await readFile(new URL('dist/index.html', root), 'utf8');
  assert.match(home, /class="home-overview-heading"[^>]*>[\s\S]*?<p>Ten complete tasks and thirty matched stage environments/, 'The concise benchmark-design paragraph remains covered by the shared paragraph rule');
  assert(css.includes('var(--type-small)'), 'The compact text token is applied, not just declared');
  assert(css.includes('var(--type-meta)'), 'The minimum metadata token is applied, not just declared');
});

test('The shared readability asset is copied verbatim and loads last in every rendered site shell', async () => {
  assert.equal(await readFile(new URL('dist/assets/readability.css', root), 'utf8'), css, 'Deployed readability CSS matches authored source');
  assert(build.includes('"readability.css"'), 'The dependency-free builder explicitly copies the shared asset');
  const files = await htmlFiles('dist');
  assert(files.length >= 18, 'All generated public and unpublished-preview shells are checked');
  let checked = 0;
  for (const file of files) {
    const html = await readFile(new URL(file, root), 'utf8');
    if (isRedirectRoute('/'+file.replace(/^dist\//,'').replace(/index\.html$/,''))) continue;
    const sheets = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([, href]) => href);
    assert(sheets.length, `${file}: a styled site shell`);
    assert.match(sheets.at(-1), /\/assets\/readability\.css(?:\?|$)/, `${file}: readability is the final stylesheet in the cascade`);
    assert.equal(sheets.filter(href => /\/assets\/readability\.css(?:\?|$)/.test(href)).length, 1, `${file}: one shared readability layer`);
    assert(sheets.some(href => /\/assets\/navigation\.css(?:\?|$)/.test(href)), `${file}: navigation keeps its original layout stylesheet`);
    checked++;
  }
  assert.equal(checked, 32, 'The full styled site, not only the home page, receives the type scale');
});

test('Shared readability rules never author sub-14px text or undersized compact controls', () => {
  const declarations = [...css.matchAll(/\bfont(?:-size)?\s*:\s*([^;{}]+)/g)];
  assert(declarations.length >= 6, 'The readability layer addresses multiple semantic text families');
  for (const [, declaration] of declarations) {
    for (const [, value] of declaration.matchAll(/(\d+(?:\.\d+)?)px\b/g)) assert(Number(value) >= 14, `No tiny text is reintroduced: ${declaration}`);
  }
  const controls = ['input', 'select', 'textarea'];
  for (const selector of controls) {
    const authored = rules(selector);
    assert(authored.some(rule => rule['font-size'] === 'var(--type-small)'), `${selector}: field text remains at least 16px and avoids mobile focus zoom`);
  }
});

test('Narrow-screen findings use full-width labelled rows instead of cramped three-column tabs', () => {
  assert.match(css, /@media\s*\([^)]*max-width\s*:\s*600px\s*\)[\s\S]*?body\s+\.findings-tabs\s*\{[^}]*grid-template-columns\s*:\s*1fr\s*;/, 'Findings switch to one full-width column on a phone');
  assert(rules('body .findings-tabs > button').some(rule => rule.display === 'grid' && /minmax\(0,\s*1fr\)/.test(rule['grid-template-columns']) && /auto/.test(rule['grid-template-columns'])), 'Each narrow tab separately aligns its index, readable name and numeric value');
  assert(rules('body .finding-tab-label').some(rule => rule['overflow-wrap'] === 'normal' && rule['min-height'] === '0'), 'Long track labels wrap at word boundaries rather than splitting individual words');
  assert(rules('body .finding-tab-label').filter(rule => rule['font-size']).every(rule => rule['font-size'] === 'var(--type-small)'), 'The stacked treatment preserves the 16px label scale');
});
